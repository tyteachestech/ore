import type { JSX, SVGProps } from "react";

/* UI icons (D105, Tyler 2026-10-30): Pixelarticons by Gerrit Halfmann (MIT, github.com/halfmage/pixelarticons, v1.8 and
   v2.4) under the names of the Phosphor icons they replaced, so call sites keep their names; Diamond and CircleHalf are
   drawn here on the same grid. Pixel art only stays sharp at sizes that land its 24-unit grid on whole device pixels, so a
   size snaps to 12 (≤13), 16 (14–19) or 24 (≥20), drawn with crisp edges. There is no fill weight: a selected icon shows
   by its row, never a second drawing. */
export type IconProps = Omit<SVGProps<SVGSVGElement>, "ref" | "children"> & { size?: number; weight?: string };
export type Icon = (props: IconProps) => JSX.Element;

const snap = (n: number) => (n <= 13 ? 12 : n < 20 ? 16 : 24);

function icon(d: string): Icon {
  return ({ size = 16, weight: _weight, ...rest }) => {
    const px = snap(size);
    return (
      <svg width={px} height={px} viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" {...rest}>
        <path d={d} />
      </svg>
    );
  };
}

export const Archive = icon("M22 4H2v6h2v10h16V10h2V4zM6 10h12v8H6v-8zm14-4v2H4V6h16zm-5 6H9v2h6v-2z");
export const ArrowClockwise = icon("M20 8H6v2h14zM4 10h2v8H4zm2 8h6v2H6z M18 6h-2v6h2zm-2-2h-2v8h2zm0 8h-2v2h2z");
export const ArrowCounterClockwise = icon("M18 20h-6v-2h6v2Zm2-2h-2v-8h2v8Zm-10-4H8v-2H6v-2H4V8h2V6h2V4h2v4h8v2h-8v4Z");
export const ArrowDown = icon("M13 12h6v2h-2v2h-2v2h-2v2h-2v-2H9v-2H7v-2H5v-2h6V4h2v8Z");
export const ArrowLeft = icon("M20 11v2H8v2H6v-2H4v-2h2V9h2v2h12zM10 7H8v2h2V7zm0 0h2V5h-2v2zm0 10H8v-2h2v2zm0 0h2v2h-2v-2z");
export const ArrowRight = icon("M4 11v2h12v2h2v-2h2v-2h-2V9h-2v2H4zm10-4h2v2h-2V7zm0 0h-2V5h2v2zm0 10h2v-2h-2v2zm0 0h-2v2h2v-2z");
export const ArrowSquareOut = icon("M21 11V3h-8v2h4v2h-2v2h-2v2h-2v2H9v2h2v-2h2v-2h2V9h2V7h2v4h2zM11 5H3v16h16v-8h-2v6H5V7h6V5z");
export const ArrowUp = icon("M11 20h2V8h2V6h-2V4h-2v2H9v2h2v12zM7 10V8h2v2H7zm0 0v2H5v-2h2zm10 0V8h-2v2h2zm0 0v2h2v-2h-2z");
export const Article = icon("M8 2h12v2H8zM6 4h2v16H6zm14 0h2v16h-2zM4 20h16v2H4zm-2-9h2v9H2zm2-2h2v2H4zm6-3h8v2h-8zm0 4h8v2h-8zm0-2h2v2h-2zm6 0h2v2h-2zm-6 5h8v2h-8zm0 3h4v2h-4z");
export const Book = icon("M8 2h12v20H4V2h4zm4 8h-2v2H8V4H6v16h12V4h-4v8h-2v-2z");
export const BookOpen = icon("M3 3h8v2H3v12h8V5h2v12h8V5h-8V3h10v16H13v2h-2v-2H1V3h2zm16 7h-4v2h4v-2zm-4-3h4v2h-4V7zm2 6h-2v2h2v-2z");
export const BookOpenText = icon("M3 3h8v2H3v12h8V5h2v12h8V5h-8V3h10v16H13v2h-2v-2H1V3h2zm16 7h-4v2h4v-2zm-4-3h4v2h-4V7zm2 6h-2v2h2v-2z");
export const CaretDown = icon("M7 8H5v2h2v2h2v2h2v2h2v-2h2v-2h2v-2h2V8h-2v2h-2v2h-2v2h-2v-2H9v-2H7V8z");
export const CaretLeft = icon("M16 5v2h-2V5h2zm-4 4V7h2v2h-2zm-2 2V9h2v2h-2zm0 2H8v-2h2v2zm2 2v-2h-2v2h2zm0 0h2v2h-2v-2zm4 4v-2h-2v2h2z");
export const CaretRight = icon("M8 5v2h2V5H8zm4 4V7h-2v2h2zm2 2V9h-2v2h2zm0 2h2v-2h-2v2zm-2 2v-2h2v2h-2zm0 0h-2v2h2v-2zm-4 4v-2h2v2H8z");
export const CaretUp = icon("M7 16H5v-2h2v-2h2v-2h2V8h2v2h2v2h2v2h2v2h-2v-2h-2v-2h-2v-2h-2v2H9v2H7v2z");
export const CaretUpDown = icon("M13 20h-2v-2h2v2Zm-2-2H9v-2h2v2Zm4 0h-2v-2h2v2Zm-6-2H7v-2h2v2Zm8-2v2h-2v-2h2Zm-8-4H7V8h2v2Zm8 0h-2V8h2v2Zm-6-2H9V6h2v2Zm4 0h-2V6h2v2Zm-2-2h-2V4h2v2Z");
export const ChatCircleDots = icon("M20 2H4v2h16zm0 14H6v2h14zm2-12h-2v12h2zM4 4H2v18h2zm2 14H4v2h2zm0-6h4v2H6zm0-4h8v2H6z");
export const Check = icon("M18 6h2v2h-2V6zm-2 4V8h2v2h-2zm-2 2v-2h2v2h-2zm-2 2h2v-2h-2v2zm-2 2h2v-2h-2v2zm-2 0v2h2v-2H8zm-2-2h2v2H6v-2zm0 0H4v-2h2v2z");
export const Circle = icon("M6 2h12v2H6zm0 18h12v2H6zM2 6h2v12H2zm18 0h2v12h-2zm-2-2h2v2h-2zm0 14h2v2h-2zM4 4h2v2H4zm0 14h2v2H4z");
export const CircleHalf = icon("M6 2h12v2H6zm0 18h12v2H6zM2 6h2v12H2zm18 0h2v12h-2zm-2-2h2v2h-2zm0 14h2v2h-2zM4 4h2v2H4zm0 14h2v2H4zM6 4h6v16H6zM4 6h2v12H4z");
export const Compass = icon("M18 22H6V20H18V22ZM6 20H4V18H6V20ZM20 20H18V18H20V20ZM10 16H12V18H10V19H8V10H10V16ZM4 18H2V6H4V18ZM22 18H20V6H22V18ZM14 16H12V14H14V16ZM16 14H14V8H12V6H14V5H16V14ZM13 13H11V11H13V13ZM12 10H10V8H12V10ZM6 6H4V4H6V6ZM20 6H18V4H20V6ZM18 4H6V2H18V4Z");
/* Drawn here on the Pixelarticons grid: four corners out (full window) and in (back beside the source). */
export const Collapse = icon("M8 3h2v7H3V8h5zM14 3h2v5h5v2h-7zM3 14h7v7H8v-5H3zM14 14h7v2h-5v5h-2z");
export const Copy = icon("M8 6h12v2H8zM4 2h12v2H4zm2 6h2v12H6zM2 4h2v12H2zm6 16h12v2H8zM20 8h2v12h-2zm-4-4h2v2h-2zM4 16h2v2H4z");
export const CornersOut = icon("M11 5h2v2h2v2h2V7h-2V5h-2V3h-2v2zM9 7V5h2v2H9zm0 0v2H7V7h2zm-5 6h16v-2H4v2zm9 6h-2v-2H9v-2H7v2h2v2h2v2h2v-2zm2-2h-2v2h2v-2zm0 0h2v-2h-2v2z");
export const CursorClick = icon("M17 9h2v3h-2zm-4-2h2v4h-2zM9 3h2v8H9zM5 3h2v10H5zm14 6h2v2h-2zm-4-2h2v2h-2zm-4 0h2v2h-2zM7 1h2v2H7zM3 11h2v2H3zm-2 2h2v2H1zm0 2h2v2H1zm2 2h2v2H3zm2 2h2v2H5zm2 2h12v2H7zm12-2h2v2h-2zm2-8h2v8h-2zM5 13h2v2H5zm2 2h2v2H7z");
export const Diamond = icon("M11 2h2v2h-2zM9 4h2v2H9zm4 0h2v2h-2zM7 6h2v2H7zm8 0h2v2h-2zM5 8h2v2H5zm12 0h2v2h-2zM3 10h2v4H3zm16 0h2v4h-2zM5 14h2v2H5zm12 0h2v2h-2zM7 16h2v2H7zm8 0h2v2h-2zM9 18h2v2H9zm4 0h2v2h-2zM11 20h2v2h-2z");
export const DotsThree = icon("M1 9h6v6H1V9zm2 2v2h2v-2H3zm6-2h6v6H9V9zm2 2v2h2v-2h-2zm6-2h6v6h-6V9zm2 2v2h2v-2h-2z");
export const Eraser = icon("M15 18h6v2H7v-2h6v-2h2v2Zm-8 0H5v-2h2v2Zm-2-2H3v-2h2v2Zm12 0h-2v-2h2v2ZM7 14H5v-2h2v2Zm8 0h-2v-2h2v2Zm4 0h-2v-2h2v2ZM9 12H7v-2h2v2Zm4 0h-2v-2h2v2Zm8 0h-2v-2h2v2Zm-10-2H9V8h2v2Zm8 0h-2V8h2v2Zm-6-2h-2V6h2v2Zm4 0h-2V6h2v2Zm-2-2h-2V4h2v2Z");
export const Expand = icon("M3 3h7v2H5v5H3zM14 3h7v7h-2V5h-5zM3 14h2v5h5v2H3zM19 14h2v7h-7v-2h5z");
export const Eye = icon("M8 6h8v2H8V6zM6 8h2v2H6V8zm10 0h2v2h-2V8zM4 10h2v4H4v-4zm14 0h2v4h-2v-4zm-12 4h2v2H6v-2zm10 0h2v2h-2v-2zm-8 2h8v2H8v-2zm2-6h4v4h-4v-4z");
export const Signpost = icon("M11 2h2v3h6v2h2v2h-2v2h-6v11h-2V11H5V9H3V7h2V5h6V2zM7 7v2h10V7H7z");
export const EyeSlash = icon("M0 10h2v4H0zm24 0h-2v4h2zm-8 0h-2v2h2zm-6 0H8v4h2zM2 8h2v2H2zm0 8h2v-2H2zm20-8h-2v2h2zm0 8h-2v-2h2zM4 6h4v2H4zm0 12h4v-2H4zM20 6h-4v2h4zM10 4h6v2h-6zM8 20h8v-2H8zm4-12h2v2h-2zm-2 6h4v2h-4zM8 8h2v2H8zm2 2h2v4h-2zm2 2h2v2h-2z M6 6h2v2H6zM4 4h2v2H4zM2 2h2v2H2zm12 12h2v2h-2zm2 2h2v2h-2zm2 2h2v2h-2zm2 2h2v2h-2z");
export const FilePdf = icon("M6 4H4v16h2zm10-2H6v2h10zm4 4h-2v14h2zm-2 14H6v2h12zM16 4h2v2h-2zm-4 0h2v6h-2z M12 8h6v2h-6zm-4 8h8v2H8zm0-4h8v2H8zm0-4h2v2H8z");
export const FileText = icon("M6 4H4v16h2zm10-2H6v2h10zm4 4h-2v14h2zm-2 14H6v2h12zM16 4h2v2h-2zm-4 0h2v6h-2z M12 8h6v2h-6zm-4 8h8v2H8zm0-4h8v2H8zm0-4h2v2H8z");
export const FileX = icon("M11 22h10V8h-2V6h-2v2h-2V6h2V4h-2V2H3v12h2V4h8v6h6v10h-8v2zm-4-2H5v2H3v-2h2v-2H3v-2h2v2h2v-2h2v2H7v2zm0 0h2v2H7v-2z");
export const GearSix = icon("M18 22H13V24H11V22H6V20H18V22ZM4 22H2V20H4V22ZM22 22H20V20H22V22ZM6 20H4V18H6V20ZM20 20H18V18H20V20ZM4 18H2V13H0V11H2V6H4V18ZM8 18H6V16H8V18ZM22 11H24V13H22V18H20V13H16V16H8V8H16V11H20V6H22V11ZM10 10V14H14V10H10ZM8 8H6V6H8V8ZM6 6H4V4H6V6ZM20 6H18V4H20V6ZM4 4H2V2H4V4ZM13 2H18V4H6V2H11V0H13V2ZM22 4H20V2H22V4Z");
export const Globe = icon("M6 2h12v2H6zm0 18h12v2H6zM18 4h2v2h-2zM4 18h2v2H4zM4 4h2v2H4zm14 14h2v2h-2zM2 6h2v12H2zm18 0h2v12h-2zM8 4h2v4H8zm2 4h4v2h-4zm4 2h4v2h-4zm4-2h2v2h-2zM4 12h2v2H4zm6 4h2v4h-2zm-4-2h4v2H6zm8 2h2v4h-2zm2-2h4v2h-4z");
export const GraduationCap = icon("M3 2h4v4H3zM2 8h12v2H2zm7-4h11v2H9zm1 10h10v2H10z M2 9h6v7H2zm0 7h2v4H2zm4 0h2v4H6zM20 6h2v8h-2z");
export const Hand = icon("M21 7h2v5h-2zm-4-2h2v7h-2zm-4-2h2v8h-2zM9 3h2v8H9zM5 5h2v8H5zm14 0h2v2h-2zm-4-2h2v2h-2zm-4-2h2v2h-2zM7 3h2v2H7zm-4 8h2v2H3zm-2 2h2v2H1zm0 2h2v2H1zm2 2h2v2H3zm2 2h2v2H5zm2 2h12v2H7zm12-2h2v2h-2zm2-7h2v7h-2zM5 13h2v2H5zm2 2h2v2H7z");
export const Headphones = icon("M19 4H5v2H3v14h7v-8H5V6h14v6h-5v8h7V6h-2V4zm-3 10h3v4h-3v-4zm-8 0v4H5v-4h3z");
export const House = icon("M4 20h16v2H4zm16-10h2v10h-2zM2 10h2v10H2zm2-2h2v2H4zm2-2h2v2H6zm2-2h2v2H8zm2-2h4v2h-4zm4 2h2v2h-2zm2 2h2v2h-2zm2 2h2v2h-2zM8 14h2v6H8zm2-2h4v2h-4zm4 2h2v6h-2z");
export const Image = icon("M4 2h16v2H4zm0 18h16v2H4zM2 4h2v16H2zm18 0h2v16h-2zm-4 8h2v2h-2zm-2 2h2v2h-2zm4 0h2v2h-2zm-8 0h2v2h-2zm2 2h2v2h-2zm2 2h2v2h-2z M20 16h2v2h-2zM8 16h2v2H8zm-2 2h2v2H6zM8 6h2v2H8zM6 8h2v2H6zm2 2h2v2H8zm2-2h2v2h-2z");
export const Info = icon("M4 2h16v2H4zm0 18h16v2H4zM2 4h2v16H2zm18 0h2v16h-2zm-9 5h2V7h-2zm0 8h2v-6h-2z");
export const Keyboard = icon("M21 3H3v18h18V3zM5 19V5h14v14H5zM9 7H7v2h2V7zm8 8H7v2h10v-2zm-2-8h2v2h-2V7zm-2 0h-2v2h2V7zm-6 4h2v2H7v-2zm10 0h-2v2h2v-2zm-6 0h2v2h-2v-2z");
export const LineSegment = icon("M4 11h16v2H4z");
export const LinkSimple = icon("M4 6h7v2H4v8h7v2H2V6h2zm16 0h-7v2h7v8h-7v2h9V6h-2zm-3 5H7v2h10v-2z");
export const LockSimple = icon("M15 2H9v2H7v4H4v14h16V8h-3V4h-2V2zm0 2v4H9V4h6zm-6 6h9v10H6V10h3zm4 3h-2v4h2v-4z");
export const LockSimpleOpen = icon("M5 8h14v2H5zm0 12h14v2H5zM3 10h2v10H3zm16 0h2v10h-2zM7 4h2v4H7zm2-2h6v2H9zm6 2h2v2h-2z");
export const MagnifyingGlass = icon("M6 2h8v2H6V2zM4 6V4h2v2H4zm0 8H2V6h2v8zm2 2H4v-2h2v2zm8 0v2H6v-2h8zm2-2h-2v2h2v2h2v2h2v2h2v-2h-2v-2h-2v-2h-2v-2zm0-8h2v8h-2V6zm0 0V4h-2v2h2z");
export const Minus = icon("M4 11h16v2H4z");
export const NotePencil = icon("M18 2h-2v2h2V2zM4 4h6v2H4v14h14v-6h2v8H2V4h2zm4 8H6v6h6v-2h2v-2h-2v2H8v-4zm4-2h-2v2H8v-2h2V8h2V6h2v2h-2v2zm2-6h2v2h-2V4zm4 0h2v2h2v2h-2v2h-2v2h-2v-2h2V8h2V6h-2V4zm-4 8h2v2h-2v-2z");
export const Paperclip = icon("M5 5h16v10H7V9h10v2H9v2h10V7H5v10h14v2H3V5h2z");
export const Pause = icon("M10 20H4V4h6v16Zm8-16v16h-6V4h6Zm-4 2v12h2V6h-2ZM6 18h2V6H6v12Z");
export const PencilSimple = icon("M4 16H6V18H8V20H10V22H2V14H4V16ZM12 20H10V18H12V20ZM14 18H12V16H14V18ZM10 16H8V14H10V16ZM16 16H14V14H16V16ZM6 14H4V12H6V14ZM12 14H10V12H12V14ZM18 14H16V12H18V14ZM8 12H6V10H8V12ZM14 12H12V10H14V12ZM20 12H18V10H20V12ZM10 10H8V8H10V10ZM18 10H16V8H18V10ZM22 10H20V8H22V10ZM12 8H10V6H12V8ZM16 8H14V6H16V8ZM20 8H18V6H20V8ZM14 6H12V4H14V6ZM18 6H16V4H18V6ZM16 4H14V2H16V4Z");
export const Play = icon("M15 11h-2V9h2zm0 4h-2v-2h2zm-2 2h-2v-2h2zm0-8h-2V7h2zm-2-2H9V5h2zM9 21H7V3h2zm6-8h2v-2h-2zm-6 4h2v2H9z");
export const PlayCircle = icon("M2 5h14v4h2V7h2V5h2v14h-2v-2h-2v-2h-2v4H2V5zm2 12h10V7H4v10z");
export const Plus = icon("M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4z");
export const Question = icon("M18 22H6V20H18V22ZM6 20H4V18H6V20ZM20 20H18V18H20V20ZM4 18H2V6H4V18ZM13 18H11V16H13V18ZM22 18H20V6H22V18ZM15 13H13V15H11V11H15V13ZM17 11H15V8H17V11ZM9 10H7V8H9V10ZM15 8H9V6H15V8ZM6 6H4V4H6V6ZM20 6H18V4H20V6ZM18 4H6V2H18V4Z");
export const Quotes = icon("M2 8h4v4H2zm6 0h4v4H8zM2 6h2v2H2zm6 0h2v2H8zM4 4h2v2H4zm6 0h2v2h-2zm4 2h8v2h-8zm0 4h8v2h-8zM2 14h20v2H2zm0 4h20v2H2z");
// A feed: a dot and two arcs, drawn on the 24 grid (Pixelarticons has none).
export const Rss = icon("M2 16h4v4H2zm0-6h4v2H2zm4 2h2v2H6zm2 2h2v2H8zm2 2h2v4h-2zM2 4h6v2H2zm6 2h4v2H8zm4 2h2v2h-2zm2 2h2v4h-2zm2 4h2v6h-2z");
export const Scroll = icon("M6 3h14v2h2v6h-2v8h-2V5H6V3zm8 14v-2H6V5H4v10H2v4h2v2h14v-2h-2v-2h-2zm0 0v2H4v-2h10z");
export const Shuffle = icon("M18 5h-2v2h2v2h-6v2h-2v6H2v2h8v-2h2v-6h6v2h-2v2h2v-2h2v-2h2V9h-2V7h-2V5zM2 9h6v2H2V9zm20 10v-2h-8v2h8z");
export const SidebarSimple = icon("M2 5h20v14H2V5zm2 2v10h2V7H4zm4 0v10h12V7H8z");
/** SidebarSimple mirrored: the reader's right side panel. */
export const SidebarRight = icon("M2 5h20v14H2V5zm2 2v10h12V7H4zm14 0v10h2V7h-2z");
export const Sparkle = icon("M11 1h2v4h-2zm0 22h2v-4h-2zM9 5h2v4H9zm0 14h2v-4H9zm4-14h2v4h-2zm0 14h2v-4h-2zM5 9h4v2H5zm14 0h-4v2h4zM1 11h4v2H1zm22 0h-4v2h4zM5 13h4v2H5zm14 0h-4v2h4z");
export const Square = icon("M2 4h2v16H2zm2 16h16v2H4zM20 4h2v16h-2zM4 2h16v2H4z");
export const Stack = icon("M3 1H1v18h18V1H3zm14 2v14H3V3h14zm4 18H5v2h18V5h-2v16zM15 5H5v2h10V5zM5 9h10v2H5V9zm7 4H5v2h7v-2z");
export const Subtitles = icon("M3 4h18v2H3zm0 14h18v2H3zM1 6h2v12H1zm20 0h2v12h-2zm-6 8h4v2h-4zM5 10h4v2H5zm0 4h8v2H5zm6-4h8v2h-8z");
export const Table = icon("M2 3h20v18H2V3zm2 4v5h7V7H4zm9 0v5h7V7h-7zm7 7h-7v5h7v-5zm-9 5v-5H4v5h7z");
export const Target = icon("M18 2H6v2H4v2H2v12h2v2h2v2h12v-2h2v-2h2V6h-2V4h-2V2zm0 2v2h2v12h-2v2H6v-2H4V6h2V4h12zm-8 6h4v4h-4v-4zM8 6h8v2H8V6zm0 10H6V8h2v8zm8 0v2H8v-2h8zm0 0h2V8h-2v8z");
export const TextAlignLeft = icon("M2 5h20v2H2zm0 6h12v2H2zm0 6h16v2H2z");
export const TextT = icon("M12 6h10v2H12zm0 4h10v2H12zM2 14h20v2H2zm0 4h20v2H2zM2 4h8v2H2zm3 2h2v6H5z M3 10h6v2H3zM2 6h2v2H2zm6 0h2v2H8z");
export const ThumbsDown = icon("M2 12h2V4H2zm2-8h14V2H4zm14 4h2V4h-2zm2 4h2V8h-2zm-6 2h6v-2h-6zm0 2h2v-2h-2zm2 4h2v-4h-2zm-2 2h2v-2h-2zm-2-2h2v-2h-2zm-2-2h2v-2h-2zm-2-2h2v-2H8zm-4-2h4v-2H4zm2-2h2V4H6z");
export const Trash = icon("M16 2v4h6v2h-2v14H4V8H2V6h6V2h8zm-2 2h-4v2h4V4zm0 4H6v12h12V8h-4zm-5 2h2v8H9v-8zm6 0h-2v8h2v-8z");
export const TreeStructure = icon("M4 14h4v2H4zm0 6h4v2H4zm-2-4h2v4H2zm6 0h2v4H8zm8-14h4v2h-4zm0 6h4v2h-4zm-2-4h2v4h-2zm6 0h2v4h-2zm-8 13h5v2h-5zm5-5h2v5h-2zM5 2h2v10H5z");
export const X = icon("M5 5h2v2H5V5zm4 4H7V7h2v2zm2 2H9V9h2v2zm2 0h-2v2H9v2H7v2H5v2h2v-2h2v-2h2v-2h2v2h2v2h2v2h2v-2h-2v-2h-2v-2h-2v-2zm2-2v2h-2V9h2zm2-2v2h-2V7h2zm0 0V5h2v2h-2z");
export const YoutubeLogo = icon("M20 20H4v-2h16v2ZM4 18H2V6h2v12Zm18 0h-2V6h2v12ZM12 9h-2v6h2v2H8V7h4v2Zm3 6h-3v-2h3v2Zm2-2h-2v-2h2v2Zm-2-2h-3V9h3v2Zm5-5H4V4h16v2Z");
