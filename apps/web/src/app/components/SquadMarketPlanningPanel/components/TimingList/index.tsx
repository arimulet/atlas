import { DetailBlock } from "../../../DetailBlock";
import { TimingListProps } from "./types";

export const TimingList = ({ title, items }: TimingListProps) => {
  return (
    <DetailBlock title={title}>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">Sin datos suficientes.</p>
      )}
    </DetailBlock>
  );
};
