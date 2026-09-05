import { revalidatePath, revalidateTag } from "next/cache";

export async function revalidateSokkerData(clubId?: string) {
  try {
    revalidateTag("sokker-data");
    revalidatePath("/", "layout");
    if (clubId) {
      revalidatePath("/squad", "page");
      revalidatePath("/training", "page");
      revalidatePath("/youth", "page");
      revalidatePath("/finances", "page");
      revalidatePath("/diagnostics", "page");
    }
  } catch {
    // Ignore when invoked outside Next.js server environment context
  }
}
