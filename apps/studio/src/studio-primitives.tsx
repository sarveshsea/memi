import type { HTMLAttributes, ReactNode } from "react";

export function TopWidget(props: {
  label: string;
  value: string;
  detail?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      {props.detail ? <small>{props.detail}</small> : null}
    </>
  );
  if (props.onClick) {
    return (
      <button className={props.active ? "top-widget active" : "top-widget"} onClick={props.onClick} type="button">
        {content}
      </button>
    );
  }
  return <article className={props.active ? "top-widget active" : "top-widget"}>{content}</article>;
}

export function WorkbenchPanel(props: {
  eyebrow?: string;
  title?: string;
  meta?: string;
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  const { eyebrow, title, meta, className, children, ...sectionProps } = props;
  return (
    <section {...sectionProps} className={className ? `workbench-panel ${className}` : "workbench-panel"}>
      {title || eyebrow || meta ? (
        <header className="panel-head">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            {title ? <h2>{title}</h2> : null}
          </div>
          {meta ? <span>{meta}</span> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function TerminalBlock(props: {
  kind: string;
  children: ReactNode;
}) {
  return <article className={`terminal-block terminal-block-surface block-${props.kind}`} data-block-kind={props.kind}>{props.children}</article>;
}

export function CommandBar(props: {
  children: ReactNode;
  "data-command-editor"?: "bottom-pinned";
}) {
  return (
    <section className="command-dock warp-command-bar" data-command-editor={props["data-command-editor"] ?? "bottom-pinned"}>
      {props.children}
    </section>
  );
}

export function SideList(props: { label: string; children: ReactNode }) {
  return (
    <div className="side-list" role="listbox" aria-label={props.label}>
      {props.children}
    </div>
  );
}
