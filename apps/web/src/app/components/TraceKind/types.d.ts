export interface TraceKindProps {
    label: string
    type: TraceKindType
}

export type TraceKindType = "observed" | "derived" | "manual" | "assumed" | "effective" | "recommended" | "inferred"
