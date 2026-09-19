// huge thanks for ertant for JS version of this

type FieldTypeInfo = {
  name?: string;
  value?: string;
};

type StructuredName = {
  surname: string;
  name: string;
  additionalName: string;
  prefix: string;
  suffix: string;
};

type Address = {
  postOfficeBox: string;
  number: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

type TypedValue<T = string> = {
  isDefault: boolean;
  valueInfo: Record<string, string | undefined>;
  value: T;
};

type VCard = {
  title?: string;
  telephone?: TypedValue[];
  displayName?: string;
  name?: StructuredName;
  email?: TypedValue[];
  categories?: string[];
  address?: TypedValue<Address>[];
  url?: string;
  notes?: string;
  organization?: string;
  birthday?: string | null;
  photo?: string;
  nickname?: string[];
  uid?: string;

  // Allows unknown non-extension fields to be preserved.
  [key: string]: unknown;
};

type ParserContext = {
  data: string[];
  currentCard: VCard;
  cards: VCard[];
  info: (message: string) => void;
  error: (message: string) => void;
};

type FieldParser = (
  context: ParserContext,
  fieldValue: string,
  fieldName: string,
  typeInfo?: FieldTypeInfo[]
) => void;

const fieldPropertyMapping: Record<string, string> = {
  TITLE: "title",
  TEL: "telephone",
  FN: "displayName",
  N: "name",
  EMAIL: "email",
  CATEGORIES: "categories",
  ADR: "address",
  URL: "url",
  NOTE: "notes",
  ORG: "organization",
  BDAY: "birthday",
  PHOTO: "photo",
};

function lookupField(
  context: ParserContext,
  fieldName: string,
): string {
  let propertyName = fieldPropertyMapping[fieldName];

  if (!propertyName && fieldName !== "BEGIN" && fieldName !== "END") {
    context.info(`define property name for ${fieldName}`);
    propertyName = fieldName;
  }

  return propertyName;
}

function removeWeirdItemPrefix(line: string): string {
  // Some lines are prefixed by "item", e.g.
  // item1.ADR;type=WORK:.....
  if (!line.startsWith("item")) {
    return line;
  }

  return line.match(/^item\d\.(.*)/)?.[1] ?? line;
}

function singleLine(
  context: ParserContext,
  fieldValue: string,
  fieldName: string,
): void {
  // Convert escaped new lines to real new lines.
  fieldValue = fieldValue.replace(/\\n/g, "\n");

  const currentValue = context.currentCard[fieldName];

  if (typeof currentValue === "string" && currentValue) {
    context.currentCard[fieldName] = `${currentValue}\n${fieldValue}`;
  } else {
    context.currentCard[fieldName] = fieldValue;
  }
}

function typedLine<T = string>(
  context: ParserContext,
  fieldValue: string,
  fieldName: string,
  typeInfo: FieldTypeInfo[] = [],
  valueFormatter?: (value: string) => T,
): void {
  let isDefault = false;

  const valueInfo = typeInfo
    .filter((type) => {
      if (type.name === "PREF") {
        isDefault = true;
        return false;
      }

      return true;
    })
    .reduce<Record<string, string | undefined>>((result, type) => {
      if (type.name) {
        result[type.name] = type.value;
      }

      return result;
    }, {});

  const values = Array.isArray(context.currentCard[fieldName])
    ? (context.currentCard[fieldName] as TypedValue<T>[])
    : [];

  values.push({
    isDefault,
    valueInfo,
    value: valueFormatter ? valueFormatter(fieldValue) : (fieldValue as T),
  });

  context.currentCard[fieldName] = values;
}

function commaSeparatedLine(
  context: ParserContext,
  fieldValue: string,
  fieldName: string,
): void {
  context.currentCard[fieldName] = fieldValue.split(",");
}

function dateLine(
  context: ParserContext,
  fieldValue: string,
  fieldName: string,
): void {
  // If value is in "19531015T231000Z" format,
  // strip the time portion.
  if (fieldValue.length === 16) {
    fieldValue = fieldValue.substring(0, 8);
  }

  let dateValue: Date;

  if (fieldValue.length === 8) {
    // "19960415" format
    const year = Number(fieldValue.substring(0, 4));
    const month = Number(fieldValue.substring(4, 6));
    const day = Number(fieldValue.substring(6, 8));

    // JS months are zero-based.
    dateValue = new Date(year, month - 1, day);
  } else {
    dateValue = new Date(fieldValue);
  }

  if (Number.isNaN(dateValue.getTime())) {
    context.error(`invalid date format ${fieldValue}`);
    context.currentCard[fieldName] = null;
    return;
  }

  // Always return ISO date format.
  context.currentCard[fieldName] = dateValue.toJSON();
}

function structured(
  fields: readonly string[],
): FieldParser {
  return (
    context,
    fieldValue,
    fieldName,
  ): void => {
    const values = fieldValue.split(";");

    context.currentCard[fieldName] = Object.fromEntries(
      fields.map((field, index) => [
        field,
        values[index] ?? "",
      ]),
    );
  };
}

function addressLine(
  context: ParserContext,
  fieldValue: string,
  fieldName: string,
  typeInfo: FieldTypeInfo[] = [],
): void {
  typedLine<Address>(
    context,
    fieldValue,
    fieldName,
    typeInfo,
    (value): Address => {
      const names = value.split(";");

      return {
        // ADR field sequence
        postOfficeBox: names[0] ?? "",
        number: names[1] ?? "",
        street: names[2] ?? "",
        city: names[3] ?? "",
        region: names[4] ?? "",
        postalCode: names[5] ?? "",
        country: names[6] ?? "",
      };
    },
  );
}

function noop(): void {
  // Intentionally empty.
}

function endCard(context: ParserContext): void {
  context.cards.push(context.currentCard);
  context.currentCard = {};
}

const fieldParsers: Record<string, FieldParser> = {
  BEGIN: noop,
  VERSION: noop,

  N: structured([
    "surname",
    "name",
    "additionalName",
    "prefix",
    "suffix",
  ]),

  TITLE: singleLine,
  TEL: typedLine,
  EMAIL: typedLine,
  ADR: addressLine,
  NOTE: singleLine,
  NICKNAME: commaSeparatedLine,
  BDAY: dateLine,
  URL: singleLine,
  CATEGORIES: commaSeparatedLine,
  END: endCard,
  FN: singleLine,
  ORG: singleLine,
  UID: singleLine,
  PHOTO: singleLine,
};

function feedData(context: ParserContext): void {
  for (const rawLine of context.data) {
    const line = removeWeirdItemPrefix(rawLine);

    const colonIndex = line.indexOf(":");

    const rawFieldName =
      colonIndex >= 0
        ? line.substring(0, colonIndex)
        : line;

    const fieldValue =
      colonIndex >= 0
        ? line.substring(colonIndex + 1)
        : "";

    let fieldName = rawFieldName;
    let fieldTypeInfo: FieldTypeInfo[] | undefined;

    // Additional type information?
    if (fieldName.includes(";")) {
      const typeInfo = fieldName.split(";");

      fieldName = typeInfo[0];

      fieldTypeInfo = typeInfo
        .slice(1)
        .map((type): FieldTypeInfo => {
          const [name, value] = type.split("=");

          return {
            name: name?.toLowerCase(),
            value: value?.replace(/"(.*)"/, "$1"),
          };
        });
    }

    // Ensure field name is uppercase.
    fieldName = fieldName.toUpperCase();

    const fieldHandler = fieldParsers[fieldName];

    if (fieldHandler) {
      fieldHandler(
        context,
        fieldValue,
        lookupField(context, fieldName),
        fieldTypeInfo,
      );
    } else if (!fieldName.startsWith("X-")) {
      // Ignore X- prefixed extension fields.
      context.info(
        `unknown field ${fieldName} with value ${fieldValue}`,
      );
    }
  }
}

export function parseVCard(data: string): VCard[] {
  const lines = data
    // Replace escaped/folded new lines.
    .replace(/\n\s{1}/g, "")
    // Split when a character directly follows a newline.
    .split(/\r\n(?=\S)|\r(?=\S)|\n(?=\S)/);

  const context: ParserContext = {
    info: (message) => console.info(message),
    error: (message) => console.error(message),
    data: lines,
    currentCard: {},
    cards: [],
  };

  feedData(context);

  return context.cards;
}