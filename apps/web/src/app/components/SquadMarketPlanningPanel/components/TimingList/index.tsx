import { TimingListProps } from "./types";

export const TimingList = ({ title, items }: TimingListProps) => {
  return (
    <div className="detail-block">
      <h4>{title}</h4>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">Sin datos suficientes.</p>
      )}
    </div>
  );
}