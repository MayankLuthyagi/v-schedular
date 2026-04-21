import type { Audience } from '@/types/audience';
import type { EmailTemplate } from '@/types/template';

export interface TemplateVariableInfo {
    original: string;
    normalized: string;
}

type TemplateLike = Pick<EmailTemplate, 'body' | 'name' | 'templateId'>;
type AudienceLike = Pick<Audience, 'columns' | 'name' | 'audienceId'>;

function normalizeToken(token: string) {
    return token.trim().toLowerCase();
}

export function extractTemplateVariables(body: string | null | undefined): TemplateVariableInfo[] {
    const html = body || '';
    const pattern = /{{\s*([^{}]+?)\s*}}/g;
    const seen = new Set<string>();
    const results: TemplateVariableInfo[] = [];
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(html)) !== null) {
        const original = (match[1] || '').trim();
        const normalized = normalizeToken(original);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        results.push({ original, normalized });
    }

    return results;
}

export function getMissingAudienceVariables(template: TemplateLike | null | undefined, audience: AudienceLike | null | undefined) {
    if (!template || !audience) return [];
    const audienceColumns = new Set((audience.columns || []).map((column) => normalizeToken(column)));
    return extractTemplateVariables(template.body).filter((variable) => !audienceColumns.has(variable.normalized));
}

export function getTemplateAudienceWarning(args: {
    template?: TemplateLike | null;
    audience?: AudienceLike | null;
    sendMethod?: string | null;
}) {
    const template = args.template || null;
    const audience = args.audience || null;
    const sendMethod = args.sendMethod || '';
    const variables = extractTemplateVariables(template?.body);

    if (!template || variables.length === 0) return null;

    if (sendMethod === 'cc' || sendMethod === 'bcc') {
        return {
            severity: 'warning' as const,
            message: `This template uses variables (${variables.map((item) => `{{${item.original}}}`).join(', ')}), but ${sendMethod.toUpperCase()} sending will not replace them.`,
        };
    }

    if (sendMethod === 'one-on-one' && audience) {
        const missingVariables = getMissingAudienceVariables(template, audience);
        if (missingVariables.length > 0) {
            return {
                severity: 'warning' as const,
                message: `Audience "${audience.name}" is missing column(s) for ${missingVariables.map((item) => `{{${item.original}}}`).join(', ')}.`,
            };
        }
    }

    return null;
}
