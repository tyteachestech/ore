import { Callout, CaretRight, CheckSquare, Code, Heading1, Heading2, Heading3, ListBullets, ListNumbers, Quotes, TextT, type Icon } from "../icons";
import type { Kind } from "./blockops";

/** Each block type's icon in Turn into (Notion's menu draws one per type). A toggle heading draws its heading's. */
export const KIND_ICON: Record<Kind, Icon> = {
  text: TextT,
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  bullet: ListBullets,
  number: ListNumbers,
  todo: CheckSquare,
  toggle: CaretRight,
  callout: Callout,
  quote: Quotes,
  code: Code,
  th1: Heading1,
  th2: Heading2,
  th3: Heading3,
};

/** The icon as a menu item draws it, for `MenuAction.icon`. */
export const kindIcon = (k: Kind) => {
  const I = KIND_ICON[k];
  return <I aria-hidden="true" />;
};
