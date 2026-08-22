import { relations } from "drizzle-orm";
import { auditEvents, emailEvents } from "./audit";
import { organizationEmailTemplates } from "./email-templates";
import {
  clients,
  organizationMembers,
  organizations,
  users,
} from "./core";
import {
  documentFields,
  documentTemplates,
  formDocuments,
  formRequests,
} from "./forms";
import { reminderDeliveries, reminderRules } from "./reminders";
import { formSessions, secureTokens } from "./sessions";
import { acceptances, signatures } from "./signing";

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  clients: many(clients),
  documentTemplates: many(documentTemplates),
  emailTemplates: many(organizationEmailTemplates),
  formRequests: many(formRequests),
  reminderRules: many(reminderRules),
  auditEvents: many(auditEvents),
  emailEvents: many(emailEvents),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMembers),
  createdFormRequests: many(formRequests),
  auditEvents: many(auditEvents),
}));

export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [organizationMembers.userId],
      references: [users.id],
    }),
  }),
);

export const clientsRelations = relations(clients, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [clients.organizationId],
    references: [organizations.id],
  }),
  formRequests: many(formRequests),
}));

export const documentTemplatesRelations = relations(
  documentTemplates,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [documentTemplates.organizationId],
      references: [organizations.id],
    }),
    fields: many(documentFields),
    formDocuments: many(formDocuments),
  }),
);

export const documentFieldsRelations = relations(documentFields, ({ one }) => ({
  organization: one(organizations, {
    fields: [documentFields.organizationId],
    references: [organizations.id],
  }),
  template: one(documentTemplates, {
    fields: [documentFields.documentTemplateId],
    references: [documentTemplates.id],
  }),
}));

export const formRequestsRelations = relations(
  formRequests,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [formRequests.organizationId],
      references: [organizations.id],
    }),
    client: one(clients, {
      fields: [formRequests.clientId],
      references: [clients.id],
    }),
    createdBy: one(users, {
      fields: [formRequests.createdByUserId],
      references: [users.id],
    }),
    documents: many(formDocuments),
    sessions: many(formSessions),
    tokens: many(secureTokens),
    reminderDeliveries: many(reminderDeliveries),
    auditEvents: many(auditEvents),
    emailEvents: many(emailEvents),
  }),
);

export const formDocumentsRelations = relations(
  formDocuments,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [formDocuments.organizationId],
      references: [organizations.id],
    }),
    request: one(formRequests, {
      fields: [formDocuments.formRequestId],
      references: [formRequests.id],
    }),
    template: one(documentTemplates, {
      fields: [formDocuments.documentTemplateId],
      references: [documentTemplates.id],
    }),
    signatures: many(signatures),
    acceptances: many(acceptances),
    auditEvents: many(auditEvents),
  }),
);

export const secureTokensRelations = relations(
  secureTokens,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [secureTokens.organizationId],
      references: [organizations.id],
    }),
    request: one(formRequests, {
      fields: [secureTokens.formRequestId],
      references: [formRequests.id],
    }),
    sessions: many(formSessions),
  }),
);

export const formSessionsRelations = relations(
  formSessions,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [formSessions.organizationId],
      references: [organizations.id],
    }),
    request: one(formRequests, {
      fields: [formSessions.formRequestId],
      references: [formRequests.id],
    }),
    token: one(secureTokens, {
      fields: [formSessions.secureTokenId],
      references: [secureTokens.id],
    }),
    signatures: many(signatures),
    acceptances: many(acceptances),
    auditEvents: many(auditEvents),
  }),
);

export const signaturesRelations = relations(signatures, ({ one }) => ({
  organization: one(organizations, {
    fields: [signatures.organizationId],
    references: [organizations.id],
  }),
  document: one(formDocuments, {
    fields: [signatures.formDocumentId],
    references: [formDocuments.id],
  }),
  session: one(formSessions, {
    fields: [signatures.formSessionId],
    references: [formSessions.id],
  }),
}));

export const acceptancesRelations = relations(acceptances, ({ one }) => ({
  organization: one(organizations, {
    fields: [acceptances.organizationId],
    references: [organizations.id],
  }),
  document: one(formDocuments, {
    fields: [acceptances.formDocumentId],
    references: [formDocuments.id],
  }),
  session: one(formSessions, {
    fields: [acceptances.formSessionId],
    references: [formSessions.id],
  }),
}));

export const reminderRulesRelations = relations(
  reminderRules,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [reminderRules.organizationId],
      references: [organizations.id],
    }),
    deliveries: many(reminderDeliveries),
  }),
);

export const reminderDeliveriesRelations = relations(
  reminderDeliveries,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [reminderDeliveries.organizationId],
      references: [organizations.id],
    }),
    request: one(formRequests, {
      fields: [reminderDeliveries.formRequestId],
      references: [formRequests.id],
    }),
    rule: one(reminderRules, {
      fields: [reminderDeliveries.reminderRuleId],
      references: [reminderRules.id],
    }),
    emailEvents: many(emailEvents),
  }),
);

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditEvents.organizationId],
    references: [organizations.id],
  }),
  actorUser: one(users, {
    fields: [auditEvents.actorUserId],
    references: [users.id],
  }),
  request: one(formRequests, {
    fields: [auditEvents.formRequestId],
    references: [formRequests.id],
  }),
  document: one(formDocuments, {
    fields: [auditEvents.formDocumentId],
    references: [formDocuments.id],
  }),
  session: one(formSessions, {
    fields: [auditEvents.formSessionId],
    references: [formSessions.id],
  }),
}));

export const organizationEmailTemplatesRelations = relations(
  organizationEmailTemplates,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationEmailTemplates.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const emailEventsRelations = relations(emailEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [emailEvents.organizationId],
    references: [organizations.id],
  }),
  request: one(formRequests, {
    fields: [emailEvents.formRequestId],
    references: [formRequests.id],
  }),
  reminderDelivery: one(reminderDeliveries, {
    fields: [emailEvents.reminderDeliveryId],
    references: [reminderDeliveries.id],
  }),
}));
