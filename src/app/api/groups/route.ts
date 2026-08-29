import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { addContact, addGroupMember, clientState, combinePayees, createGroup, uncombinePayees } from "@/lib/data/repo";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json()) as {
    action: "create" | "add-member" | "add-contact" | "combine" | "uncombine";
    name?: string;
    groupId?: string;
    paynow?: string;
    a?: string;
    b?: string;
    settler?: string;
    pairId?: string;
  };
  try {
    if (body.action === "create") {
      await createGroup(user.id, body.name || "Group");
    } else if (body.action === "add-member") {
      if (!body.groupId || !body.name) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }
      await addGroupMember(user.id, body.groupId, body.name, body.paynow);
    } else if (body.action === "combine") {
      if (!body.a || !body.b || !body.settler) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }
      await combinePayees(user.id, body.a, body.b, body.settler);
    } else if (body.action === "uncombine") {
      if (!body.pairId) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }
      await uncombinePayees(user.id, body.pairId);
    } else {
      if (!body.name) return NextResponse.json({ error: "Name required" }, { status: 400 });
      await addContact(user.id, body.name, body.paynow, body.groupId);
    }
    return NextResponse.json(await clientState(user.id));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
