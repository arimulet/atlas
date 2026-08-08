import { DetailBlockProps } from "./types";

export const DetailBlock = ({ title, children }: DetailBlockProps) => {
  return (
    <div className="detail-block">
      {title && <h4>{title}</h4>}
      {children}
    </div>
  );
};
