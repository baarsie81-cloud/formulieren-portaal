export const AUDIT_ACTIONS = {
  CLIENT_CREATED: "client.created",
  CLIENT_UPDATED: "client.updated",
  CLIENT_ARCHIVED: "client.archived",
  TEMPLATE_CREATED: "template.created",
  TEMPLATE_UPDATED: "template.updated",
  TEMPLATE_ARCHIVED: "template.archived",
  TEMPLATE_FIELDS_UPDATED: "template.fields_updated",
} as const;

export const AUDIT_ENTITY_TYPES = {
  CLIENT: "client",
  DOCUMENT_TEMPLATE: "document_template",
} as const;
