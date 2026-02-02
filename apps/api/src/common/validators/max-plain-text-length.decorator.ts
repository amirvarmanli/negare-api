import {
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { countPlainTextCharacters } from '@app/common/utils/plain-text.util';

const DECORATOR_NAME = 'maxPlainTextLength';

export interface MaxPlainTextLengthValidationOptions
  extends ValidationOptions {
  errorCode?: string;
}

export function MaxPlainTextLength(
  maxLength: number,
  options?: MaxPlainTextLengthValidationOptions,
) {
  const { context, message, errorCode, ...validationOptions } = options ?? {};

  const defaultMessage = `Plain text must not exceed ${maxLength} characters.`;
  const mergedContext = {
    ...(context ?? {}),
    errorCode:
      errorCode ??
      (context?.errorCode as string | undefined) ??
      'MAX_PLAIN_TEXT_LENGTH',
    maxLength,
  };

  return (target: object, propertyName: string) => {
    registerDecorator({
      name: DECORATOR_NAME,
      target: target.constructor,
      propertyName,
      constraints: [maxLength],
      options: {
        ...validationOptions,
        message: message ?? defaultMessage,
        context: mergedContext,
      },
      validator: {
        validate(value: unknown) {
          if (value === null || value === undefined || value === '') {
            return true;
          }
          if (typeof value !== 'string') {
            return false;
          }
          return countPlainTextCharacters(value) <= maxLength;
        },
      },
    });
  };
}
