import { SectionProps } from "./types";
import classNames from "classnames";

export const Section = ({
  title,
  subtitle,
  description,
  className,
  tone = "normal",
  children
}: SectionProps) => (
  <section className={classNames(`panel ${tone}`, className)}>
    <div className="panel-heading">
      {title && <p className="eyebrow">{title}</p>}
      {subtitle && <h2>{subtitle}</h2>}
      {description && <p className="muted">{description}</p>}
    </div>
    {children}
  </section>
);
