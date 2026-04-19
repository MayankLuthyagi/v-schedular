export interface AudienceContact {
    email: string;
    [key: string]: string; // dynamic columns from sheet headers
}

export interface Audience {
    _id?: string;
    audienceId: string;
    name: string;
    columns: string[]; // sheet column headers e.g. ["name", "email", "company"]
    contacts: AudienceContact[];
    totalContacts: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface AudienceFormData {
    name: string;
    file: File | null;
}
