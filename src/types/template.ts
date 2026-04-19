export interface EmailTemplate {
    _id?: string;
    templateId: string;
    name: string;
    subject: string;
    body: string; // HTML
    createdAt: Date;
    updatedAt: Date;
}

export interface EmailTemplateFormData {
    name: string;
    subject: string;
    body: string;
}
