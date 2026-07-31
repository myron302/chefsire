# Catering portfolio media lifecycle

Portfolio item deletion removes the database metadata only. The underlying local or
Cloudflare R2 objects are intentionally retained, including images from items that a
provider replaces and later deletes.

This can produce orphaned image files over time. It is accepted technical debt because
the shared upload system is also used by posts and other product surfaces, but currently
has no canonical media registry, usage references, or reference counting. Deleting an
object based only on a portfolio row could therefore remove media still used elsewhere.

Safe physical cleanup should be introduced only with a shared media asset registry that:

1. records asset ownership and every application reference;
2. distinguishes original and derived thumbnail objects;
3. deletes objects only after their reference count reaches zero; and
4. includes a reconciliation job for existing local and R2 objects.
