'use client';

import React, { useMemo, useCallback } from 'react';
import { createEditor, Descendant, Editor, Text } from 'slate';
import { Slate, Editable, withReact, useSlate, ReactEditor } from 'slate-react';
import { withHistory } from 'slate-history';
import { FiBold, FiItalic, FiCode } from 'react-icons/fi';
import { useTheme } from '@/contexts/ThemeContext';

// ---------- Slate types ----------
type LinkElement = { type: 'link'; url: string; children: CustomText[] };
type ListItemElement = { type: 'list-item'; children: (CustomText | LinkElement)[] };
type BulletedListElement = { type: 'bulleted-list'; children: ListItemElement[] };
type NumberedListElement = { type: 'numbered-list'; children: ListItemElement[] };
type ParagraphElement = { type: 'paragraph'; children: (CustomText | LinkElement)[] };
type CustomElement = ParagraphElement | LinkElement | ListItemElement | BulletedListElement | NumberedListElement;
type CustomText = { text: string; bold?: true; italic?: true; code?: true; underline?: true };

interface RenderLeafProps { attributes: Record<string, unknown>; children: React.ReactNode; leaf: CustomText; }
interface RenderElementProps { attributes: Record<string, unknown>; children: React.ReactNode; element: CustomElement; }

declare module 'slate' {
    interface CustomTypes {
        Editor: ReactEditor & { type?: string };
        Element: CustomElement;
        Text: CustomText;
    }
}

export const initialSlateValue: Descendant[] = [{ type: 'paragraph', children: [{ text: '' }] }];

// ---------- Serialise Slate → HTML ----------
export const serializeSlateToHTML = (nodes: Descendant[]): string =>
    nodes.map(node => {
        if (Text.isText(node)) {
            let html = node.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            if (node.bold) html = `<strong>${html}</strong>`;
            if (node.italic) html = `<em>${html}</em>`;
            if (node.code) html = `<code>${html}</code>`;
            if (node.underline) html = `<u>${html}</u>`;
            return html;
        }
        const children = serializeSlateToHTML(node.children as Descendant[]);
        switch (node.type) {
            case 'paragraph': return `<p>${children}</p>`;
            case 'link': return `<a href="${(node as LinkElement).url}" target="_blank" rel="noopener noreferrer">${children}</a>`;
            case 'bulleted-list': return `<ul>${children}</ul>`;
            case 'numbered-list': return `<ol>${children}</ol>`;
            case 'list-item': return `<li>${children}</li>`;
            default: return children;
        }
    }).join('');

// ---------- Deserialise HTML → Slate ----------
export const deserializeHTMLToSlate = (html: string): Descendant[] => {
    if (!html) return initialSlateValue;
    const parsed = new DOMParser().parseFromString(html, 'text/html');

    const deserialize = (el: Node, parentMarks: Partial<CustomText> = {}): (Descendant | CustomText | LinkElement)[] => {
        if (el.nodeType === Node.TEXT_NODE) {
            if (!el.textContent) return [];
            return [{ text: el.textContent, ...parentMarks }];
        }
        if (el.nodeType !== Node.ELEMENT_NODE) return [];

        const element = el as HTMLElement;
        const nodeName = element.nodeName;
        let currentMarks: Partial<CustomText> = {};
        const isFormatting = ['STRONG', 'B', 'EM', 'I', 'U', 'CODE', 'SPAN', 'A'].includes(nodeName);
        if (isFormatting) currentMarks = { ...parentMarks };

        switch (nodeName) {
            case 'STRONG': case 'B': currentMarks.bold = true; break;
            case 'EM': case 'I': currentMarks.italic = true; break;
            case 'U': currentMarks.underline = true; break;
            case 'CODE': currentMarks.code = true; break;
        }
        if (nodeName === 'SPAN') {
            const s = element.style;
            if (s.fontWeight === 'bold' || (!isNaN(parseInt(s.fontWeight)) && parseInt(s.fontWeight) >= 600)) currentMarks.bold = true;
            if (s.fontStyle === 'italic') currentMarks.italic = true;
            if (s.textDecoration?.includes('underline')) currentMarks.underline = true;
        }

        const children = Array.from(element.childNodes).flatMap(c => deserialize(c, currentMarks)).flat();

        switch (nodeName) {
            case 'BODY': case 'HTML': return children;
            case 'BR': return [{ text: '\n' }];
            case 'P': case 'DIV': case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6': {
                const pc = children.filter((c): c is CustomText | LinkElement =>
                    Text.isText(c) || (typeof c === 'object' && 'type' in c && (c as CustomElement).type === 'link'));
                return [{ type: 'paragraph', children: pc.length > 0 ? pc : [{ text: '' }] }];
            }
            case 'UL': {
                const li = children.filter((c): c is ListItemElement =>
                    !Text.isText(c) && typeof c === 'object' && 'type' in c && (c as CustomElement).type === 'list-item');
                return li.length === 0 ? [] : [{ type: 'bulleted-list', children: li }];
            }
            case 'OL': {
                const li = children.filter((c): c is ListItemElement =>
                    !Text.isText(c) && typeof c === 'object' && 'type' in c && (c as CustomElement).type === 'list-item');
                return li.length === 0 ? [] : [{ type: 'numbered-list', children: li }];
            }
            case 'LI': {
                const extractInline = (nodes: (Descendant | CustomText | LinkElement)[]): (CustomText | LinkElement)[] => {
                    const r: (CustomText | LinkElement)[] = [];
                    for (const n of nodes) {
                        if (Text.isText(n)) { r.push(n); }
                        else if (typeof n === 'object' && 'type' in n) {
                            if ((n as CustomElement).type === 'link') { r.push(n as LinkElement); }
                            else if ('children' in n) { r.push(...extractInline((n as ParagraphElement).children)); }
                        }
                    }
                    return r;
                };
                const inline = extractInline(children);
                return [{ type: 'list-item', children: inline.length > 0 ? inline : [{ text: '' }] }];
            }
            case 'A': {
                const href = element.getAttribute('href') || '';
                const lc = children.filter(Text.isText);
                if (lc.length === 0) lc.push({ text: element.textContent || '', ...currentMarks });
                return [{ type: 'link', url: href, children: lc }];
            }
            default: return children;
        }
    };

    const result = deserialize(parsed.body);
    const nodes = result.filter((n): n is Descendant =>
        !Text.isText(n) && typeof n === 'object' && 'type' in n && 'children' in n);
    return nodes.length > 0 ? nodes : initialSlateValue;
};

// ---------- Mark button ----------
const MarkButton = ({ format, icon }: { format: 'bold' | 'italic' | 'code'; icon: React.ReactNode }) => {
    const editor = useSlate();
    const { settings } = useTheme();
    const isActive = Editor.marks(editor)?.[format] === true;
    return (
        <button
            type="button"
            onMouseDown={e => {
                e.preventDefault();
                isActive ? Editor.removeMark(editor, format) : Editor.addMark(editor, format, true);
            }}
            className="px-2 py-1 border rounded hover:bg-gray-200"
            style={{ backgroundColor: isActive ? settings.themeColor : 'white', color: isActive ? 'white' : 'inherit' }}
        >
            {icon}
        </button>
    );
};

// ---------- Main exported component ----------
interface SlateEmailEditorProps {
    value: Descendant[];
    onChange: (v: Descendant[]) => void;
    editorKey?: string;
    minHeight?: string;
    placeholder?: string;
}

export default function SlateEmailEditor({ value, onChange, editorKey, minHeight = '250px', placeholder }: SlateEmailEditorProps) {
    const editor = useMemo(() => {
        const e = withHistory(withReact(createEditor()));
        const { isInline, normalizeNode } = e;
        e.isInline = el => el.type === 'link' ? true : isInline(el);
        e.normalizeNode = entry => {
            if (entry[1].length === 0 && e.children.length === 0) {
                e.children.push({ type: 'paragraph', children: [{ text: '' }] });
                return;
            }
            normalizeNode(entry);
        };
        return e;
    }, []);

    const renderLeaf = useCallback((props: RenderLeafProps) => {
        let c = props.children;
        if (props.leaf.bold) c = <strong>{c}</strong>;
        if (props.leaf.italic) c = <em>{c}</em>;
        if (props.leaf.code) c = <code>{c}</code>;
        if (props.leaf.underline) c = <u>{c}</u>;
        return <span {...props.attributes}>{c}</span>;
    }, []);

    const renderElement = useCallback((props: RenderElementProps) => {
        const { attributes, children, element } = props;
        switch (element.type) {
            case 'link':
                return <a {...attributes} href={(element as LinkElement).url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">{children}</a>;
            case 'bulleted-list':
                return <ul {...attributes} className="list-disc list-inside ml-4">{children}</ul>;
            case 'numbered-list':
                return <ol {...attributes} className="list-decimal list-inside ml-4">{children}</ol>;
            case 'list-item':
                return <li {...attributes}>{children}</li>;
            default:
                return <p {...attributes}>{children}</p>;
        }
    }, []);

    const safeValue = useMemo(() => {
        const valid = (value || []).filter((n): n is Descendant =>
            !Text.isText(n) && typeof n === 'object' && 'type' in n && 'children' in n);
        return valid.length > 0 ? valid : initialSlateValue;
    }, [value]);

    const handlePaste = useCallback((event: React.ClipboardEvent) => {
        event.preventDefault();
        const html = event.clipboardData.getData('text/html');
        if (html) {
            try {
                const fragment = deserializeHTMLToSlate(html);
                if (fragment?.length > 0) {
                    if (!editor.selection) editor.selection = { anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 0 } };
                    Editor.insertFragment(editor, fragment);
                }
            } catch {
                const text = event.clipboardData.getData('text/plain');
                if (text) Editor.insertText(editor, text);
            }
        } else {
            const text = event.clipboardData.getData('text/plain');
            if (text) Editor.insertText(editor, text);
        }
    }, [editor]);

    return (
        <div className="border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500">
            <Slate
                key={`slate-${editorKey}-${JSON.stringify(safeValue).slice(0, 40)}`}
                editor={editor}
                initialValue={safeValue}
                onValueChange={onChange}
            >
                <div className="border-b p-2 flex gap-2 bg-gray-50">
                    <MarkButton format="bold" icon={<FiBold />} />
                    <MarkButton format="italic" icon={<FiItalic />} />
                    <MarkButton format="code" icon={<FiCode />} />
                </div>
                <Editable
                    renderLeaf={renderLeaf}
                    renderElement={renderElement}
                    className="p-3 focus:outline-none"
                    style={{ minHeight }}
                    placeholder={placeholder || 'Write your email content here... Use {{field_name}} to insert contact data.'}
                    onPaste={handlePaste}
                />
            </Slate>
        </div>
    );
}
