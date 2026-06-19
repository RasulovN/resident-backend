import { pgEnum } from 'drizzle-orm/pg-core';

export const userStatusEnum = pgEnum('user_status', ['pending', 'active', 'suspended']);

export const verificationTokenTypeEnum = pgEnum('verification_token_type', [
  'email_verify',
  'password_reset',
  'invite',
]);

export const organizationStatusEnum = pgEnum('organization_status', [
  'active',
  'trial',
  'suspended',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trial',
  'active',
  'expired',
]);

export const memberStatusEnum = pgEnum('member_status', ['invited', 'active', 'suspended']);

export const permissionScopeEnum = pgEnum('permission_scope', ['platform', 'organization']);

export const menuTypeEnum = pgEnum('menu_type', [
  'group',
  'static_module',
  'dynamic_entity',
  'link',
]);

export const entityFieldTypeEnum = pgEnum('entity_field_type', [
  'text',
  'textarea',
  'number',
  'boolean',
  'date',
  'datetime',
  'select',
  'multiselect',
  'relation',
  'file',
  'image',
]);

export const recordStatusEnum = pgEnum('record_status', ['active', 'inactive', 'archived']);

export const planIntervalEnum = pgEnum('plan_interval', ['month', 'year']);

// Mahalla OS enums
export const genderEnum = pgEnum('gender', ['male', 'female', 'other']);

export const residentStatusEnum = pgEnum('resident_status', [
  'active',
  'inactive',
  'relocated',
  'deceased',
]);

export const employmentStatusEnum = pgEnum('employment_status', [
  'employed',
  'unemployed',
  'self_employed',
  'student',
  'pensioner',
  'housewife',
  'other',
]);

export const buildingTypeEnum = pgEnum('building_type', [
  'apartment_block',
  'private_house',
  'commercial',
  'mixed',
  'school',
  'kindergarten',
  'hospital',
  'government',
  'other',
]);

export const buildingStatusEnum = pgEnum('building_status', [
  'active',
  'under_repair',
  'under_construction',
  'demolished',
]);

export const apartmentTypeEnum = pgEnum('apartment_type', ['apartment', 'house', 'room', 'office']);

export const populationEventTypeEnum = pgEnum('population_event_type', [
  'birth',
  'death',
  'marriage',
  'divorce',
  'newborn',
  'graduation',
  'other',
]);

export const relocationTypeEnum = pgEnum('relocation_type', [
  'internal',
  'inter_mahalla',
  'temporary',
  'permanent',
  'city_exit',
  'city_enter',
]);

export const relocationStatusEnum = pgEnum('relocation_status', [
  'pending',
  'approved',
  'completed',
  'rejected',
]);

export const providerVerificationStatusEnum = pgEnum('provider_verification_status', [
  'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'
]);

export const providerOrderStatusEnum = pgEnum('provider_order_status', [
  'NEW', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
]);

export const providerDocumentTypeEnum = pgEnum('provider_document_type', [
  'passport', 'license', 'certificate', 'other'
]);

// ─── Inquiries (Murojaatlar) ──────────────────────────────────────────────────
// Lifecycle aligned with the Uzbek law "On appeals of individuals and legal
// entities": appeals are reviewed within 15 days; up to 1 month when additional
// study is required; the term may be extended in exceptional cases with written
// notification to the applicant explaining the reason for the delay.

export const inquiryStatusEnum = pgEnum('inquiry_status', [
  'NEW',          // Yangi — kelib tushdi, hali ko'rilmagan
  'IN_PROGRESS',  // Jarayonda — mas'ul tayinlandi / ish boshlandi
  'NEEDS_INFO',   // Qo'shimcha ma'lumot kerak — fuqarodan javob kutilmoqda
  'ESCALATED',    // Yuqori organga (tuman/hokimlik) yo'naltirildi
  'RESOLVED',     // Hal qilindi — yakuniy javob berildi
  'REJECTED',     // Rad etildi — asossiz / qonunga zid
  'CLOSED',       // Yopildi — fuqaro tasdiqladi yoki muddat tugadi
]);

export const inquiryCategoryEnum = pgEnum('inquiry_category', [
  'COMPLAINT',       // Shikoyat
  'APPLICATION',     // Ariza / talab
  'SUGGESTION',      // Taklif
  'SOCIAL_AID',      // Ijtimoiy yordam
  'UTILITY',         // Kommunal xizmatlar
  'INFRASTRUCTURE',  // Obodonlashtirish / infratuzilma
  'SECURITY',        // Xavfsizlik / tartib
  'OTHER',           // Boshqa
]);

export const inquiryPriorityEnum = pgEnum('inquiry_priority', [
  'LOW', 'MEDIUM', 'HIGH', 'URGENT',
]);

export const inquiryEventTypeEnum = pgEnum('inquiry_event_type', [
  'CREATED',
  'STATUS_CHANGED',
  'COMMENT',
  'ASSIGNED',
  'DEADLINE_EXTENDED',
  'ESCALATED',
  'RESOLVED',
  'REOPENED',
  'RATED',
]);
