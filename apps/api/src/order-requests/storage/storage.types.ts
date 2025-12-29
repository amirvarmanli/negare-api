import { OrderFileKind } from '@prisma/client';

export interface OrderRequestFileSaveArgs {
  orderRequestId: string;
  file: Express.Multer.File;
  kind: OrderFileKind;
}

export interface OrderRequestFileSaveResult {
  storageKey: string;
  size: number;
  mimeType: string;
  originalName: string;
  kind: OrderFileKind;
}

export interface StorageService {
  saveOrderRequestFile(
    args: OrderRequestFileSaveArgs,
  ): Promise<OrderRequestFileSaveResult>;
  remove(storageKey: string): Promise<void>;
}

export const ORDER_REQUEST_STORAGE = Symbol('ORDER_REQUEST_STORAGE');
