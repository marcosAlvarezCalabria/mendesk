import type { AppointmentRepository } from "@/application/ports/AppointmentRepository";
import type { AppointmentListReader } from "@/application/ports/AppointmentListReader";
import type { AppointmentHistoryReader } from "@/application/ports/AppointmentHistoryReader";
import type { AuthService } from "@/application/ports/AuthService";
import type { ClientRepository } from "@/application/ports/ClientRepository";
import type { ClientListReader } from "@/application/ports/ClientListReader";
import type { GarmentRepository } from "@/application/ports/GarmentRepository";
import type { HealthCheck } from "@/application/ports/HealthCheck";
import type { OrderListReader } from "@/application/ports/OrderListReader";
import type { OrdersOverviewReader } from "@/application/ports/OrdersOverviewReader";
import { createDirectusOrdersOverviewReader } from "@/infrastructure/directus/DirectusOrdersOverviewReader";
import type { OrderRepository } from "@/application/ports/OrderRepository";
import type { OrderSequenceProvider } from "@/application/ports/OrderSequenceProvider";
import type { PaymentRepository } from "@/application/ports/PaymentRepository";
import type { PhotoStorage } from "@/application/ports/PhotoStorage";
import type { StatsProvider } from "@/application/ports/StatsProvider";
import { createDirectusAppointmentGateway } from "@/infrastructure/directus/DirectusAppointmentGateway";
import { DirectusAppointmentRepository } from "@/infrastructure/directus/DirectusAppointmentRepository";
import { createDirectusAuthClient } from "@/infrastructure/directus/DirectusAuthClient";
import { DirectusAuthService } from "@/infrastructure/directus/DirectusAuthService";
import { createDirectusClientGateway } from "@/infrastructure/directus/DirectusClientGateway";
import { DirectusClientRepository } from "@/infrastructure/directus/DirectusClientRepository";
import { createDirectusFilesGateway } from "@/infrastructure/directus/DirectusFilesGateway";
import { createDirectusGarmentGateway } from "@/infrastructure/directus/DirectusGarmentGateway";
import { DirectusGarmentRepository } from "@/infrastructure/directus/DirectusGarmentRepository";
import { createDirectusHealthClient } from "@/infrastructure/directus/DirectusHealthClient";
import { DirectusHealthCheck } from "@/infrastructure/directus/DirectusHealthCheck";
import { createDirectusOrderClient } from "@/infrastructure/directus/DirectusOrderClient";
import { DirectusOrderRepository } from "@/infrastructure/directus/DirectusOrderRepository";
import { createDirectusOrderSequenceClient } from "@/infrastructure/directus/DirectusOrderSequenceClient";
import { DirectusOrderSequenceProvider } from "@/infrastructure/directus/DirectusOrderSequenceProvider";
import { createDirectusPaymentGateway } from "@/infrastructure/directus/DirectusPaymentGateway";
import { DirectusPaymentRepository } from "@/infrastructure/directus/DirectusPaymentRepository";
import { DirectusPhotoStorage } from "@/infrastructure/directus/DirectusPhotoStorage";
import { createDirectusStatsGateway } from "@/infrastructure/directus/DirectusStatsGateway";
import { DirectusStatsProvider } from "@/infrastructure/directus/DirectusStatsProvider";

export function makeHealthCheck(): HealthCheck {
  const url = getDirectusUrl();

  return new DirectusHealthCheck(createDirectusHealthClient(url));
}

export function makeAuthService(): AuthService {
  const url = getDirectusUrl();

  return new DirectusAuthService(createDirectusAuthClient(url));
}

export function makeOrderRepository(token: string): OrderRepository {
  const url = getDirectusUrl();

  return new DirectusOrderRepository(createDirectusOrderClient(url, token));
}

export function makeOrderListReader(token: string): OrderListReader {
  const url = getDirectusUrl();

  return new DirectusOrderRepository(createDirectusOrderClient(url, token));
}

export function makeOrdersOverviewReader(token: string): OrdersOverviewReader {
  return createDirectusOrdersOverviewReader(getDirectusUrl(), token);
}

export function makeClientRepository(token: string): ClientRepository {
  const url = getDirectusUrl();

  return new DirectusClientRepository(createDirectusClientGateway(url, token));
}

export function makeClientListReader(token: string): ClientListReader {
  const url = getDirectusUrl();

  return new DirectusClientRepository(createDirectusClientGateway(url, token));
}

export function makeKioskClientRepository(): ClientRepository {
  const url = getDirectusUrl();
  const token = process.env.KIOSK_TOKEN;

  if (!token) {
    throw new Error("KIOSK_TOKEN is not set");
  }

  return new DirectusClientRepository(createDirectusClientGateway(url, token));
}

export function makeGarmentRepository(token: string): GarmentRepository {
  const url = getDirectusUrl();

  return new DirectusGarmentRepository(createDirectusGarmentGateway(url, token));
}

export function makeAppointmentRepository(token: string): AppointmentRepository {
  const url = getDirectusUrl();

  return new DirectusAppointmentRepository(createDirectusAppointmentGateway(url, token));
}

export function makeAppointmentListReader(token: string): AppointmentListReader {
  const url = getDirectusUrl();

  return new DirectusAppointmentRepository(createDirectusAppointmentGateway(url, token));
}

export function makeAppointmentHistoryReader(token: string): AppointmentHistoryReader {
  const url = getDirectusUrl();

  return new DirectusAppointmentRepository(createDirectusAppointmentGateway(url, token));
}

export function makePaymentRepository(token: string): PaymentRepository {
  const url = getDirectusUrl();

  return new DirectusPaymentRepository(createDirectusPaymentGateway(url, token));
}

export function makeOrderSequenceProvider(token: string): OrderSequenceProvider {
  const url = getDirectusUrl();

  return new DirectusOrderSequenceProvider(createDirectusOrderSequenceClient(url, token));
}

export function makeStatsProvider(token: string): StatsProvider {
  const url = getDirectusUrl();

  return new DirectusStatsProvider(createDirectusStatsGateway(url, token));
}

export function makePhotoStorage(token: string): PhotoStorage {
  const url = getDirectusUrl();

  return new DirectusPhotoStorage(createDirectusFilesGateway(url, token));
}

function getDirectusUrl(): string {
  const url = process.env.DIRECTUS_URL;

  if (!url) {
    throw new Error("DIRECTUS_URL is not set");
  }

  return url;
}
