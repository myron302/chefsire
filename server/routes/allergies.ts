import express, { type Request, type Response } from "express";
import { db } from "@db";
import { eq, and, or, inArray } from "drizzle-orm";
import { familyMembers, allergenProfiles, recipeAllergens, userSubstitutionPreferences, productAllergens, recipes } from "@db/schema";
import { requireAuth } from "../middleware/index";

const router = express.Router();

// ============================================================
// FAMILY MEMBERS MANAGEMENT
// ============================================================

// Get all family members for current user
router.get("/family-members", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, userId))
      .orderBy(familyMembers.createdAt);

    // Get allergen profiles for each member
    const membersWithAllergens = await Promise.all(
      members.map(async (member) => {
        const allergens = await db
          .select()
          .from(allergenProfiles)
          .where(eq(allergenProfiles.familyMemberId, member.id));

        return {
          ...member,
          allergenCount: allergens.length,
          severeCases: allergens.filter(a => ["severe", "life-threatening"].includes(a.severity)).length,
        };
      })
    );

    res.json({ members: membersWithAllergens });
  } catch (error) {
    console.error("Error fetching family members:", error);
    res.status(500).json({ message: "Failed to fetch family members" });
  }
});

// Add family member
router.post("/family-members", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, relationship, dateOfBirth, species } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    const [newMember] = await db
      .insert(familyMembers)
      .values({
        userId,
        name: name.trim(),
        relationship: relationship || null,
        dateOfBirth: dateOfBirth || null,
        species: species || "human",
      })
      .returning();

    res.json({ member: newMember });
  } catch (error) {
    console.error("Error adding family member:", error);
    res.status(500).json({ message: "Failed to add family member" });
  }
});

// Update family member
router.put("/family-members/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const memberId = req.params.id;
    const { name, relationship, dateOfBirth, species, notes } = req.body;

    // Verify ownership
    const [existing] = await db
      .select()
      .from(familyMembers)
      .where(and(eq(familyMembers.id, memberId), eq(familyMembers.userId, userId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Family member not found" });
    }

    const [updated] = await db
      .update(familyMembers)
      .set({
        name: name?.trim() || existing.name,
        relationship: relationship !== undefined ? relationship : existing.relationship,
        dateOfBirth: dateOfBirth !== undefined ? dateOfBirth : existing.dateOfBirth,
        species: species || existing.species,
        notes: notes !== undefined ? notes : existing.notes,
      })
      .where(eq(familyMembers.id, memberId))
      .returning();

    res.json({ member: updated });
  } catch (error) {
    console.error("Error updating family member:", error);
    res.status(500).json({ message: "Failed to update family member" });
  }
});

// Delete family member
router.delete("/family-members/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const memberId = req.params.id;

    // Verify ownership
    const [existing] = await db
      .select()
      .from(familyMembers)
      .where(and(eq(familyMembers.id, memberId), eq(familyMembers.userId, userId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Family member not found" });
    }

    // Delete allergen profiles first (cascade should handle this but being explicit)
    await db.delete(allergenProfiles).where(eq(allergenProfiles.familyMemberId, memberId));

    // Delete member
    await db.delete(familyMembers).where(eq(familyMembers.id, memberId));

    res.json({ message: "Family member deleted" });
  } catch (error) {
    console.error("Error deleting family member:", error);
    res.status(500).json({ message: "Failed to delete family member" });
  }
});

// ============================================================
// ALLERGEN PROFILES
// ============================================================

// Get allergen profiles for a family member
router.get("/profiles/:memberId", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { memberId } = req.params;

    // Verify member belongs to user
    const [member] = await db
      .select()
      .from(familyMembers)
      .where(and(eq(familyMembers.id, memberId), eq(familyMembers.userId, userId)))
      .limit(1);

    if (!member) {
      return res.status(404).json({ message: "Family member not found" });
    }

    const profiles = await db
      .select()
      .from(allergenProfiles)
      .where(eq(allergenProfiles.familyMemberId, memberId))
      .orderBy(allergenProfiles.createdAt);

    res.json({ profiles });
  } catch (error) {
    console.error("Error fetching allergen profiles:", error);
    res.status(500).json({ message: "Failed to fetch allergen profiles" });
  }
});

// Add allergen profile
router.post("/profiles", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { familyMemberId, allergen, severity, diagnosedBy, diagnosedDate, notes } = req.body;

    if (!familyMemberId || !allergen || !severity) {
      return res.status(400).json({ message: "Family member, allergen, and severity are required" });
    }

    // Verify member belongs to user
    const [member] = await db
      .select()
      .from(familyMembers)
      .where(and(eq(familyMembers.id, familyMemberId), eq(familyMembers.userId, userId)))
      .limit(1);

    if (!member) {
      return res.status(404).json({ message: "Family member not found" });
    }

    // Check if allergen profile already exists
    const [existing] = await db
      .select()
      .from(allergenProfiles)
      .where(
        and(
          eq(allergenProfiles.familyMemberId, familyMemberId),
          eq(allergenProfiles.allergen, allergen.toLowerCase().trim())
        )
      )
      .limit(1);

    if (existing) {
      return res.status(400).json({ message: "This allergen is already tracked for this family member" });
    }

    const [profile] = await db
      .insert(allergenProfiles)
      .values({
        familyMemberId,
        allergen: allergen.toLowerCase().trim(),
        severity,
        diagnosedBy: diagnosedBy || null,
        diagnosedDate: diagnosedDate || null,
        notes: notes || null,
      })
      .returning();

    res.json({ profile });
  } catch (error) {
    console.error("Error adding allergen profile:", error);
    res.status(500).json({ message: "Failed to add allergen profile" });
  }
});

// Update allergen profile
router.put("/profiles/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const profileId = req.params.id;
    const { severity, diagnosedBy, diagnosedDate, notes } = req.body;

    // Get profile and verify ownership through family member
    const [profile] = await db
      .select({
        profile: allergenProfiles,
        member: familyMembers,
      })
      .from(allergenProfiles)
      .innerJoin(familyMembers, eq(allergenProfiles.familyMemberId, familyMembers.id))
      .where(and(eq(allergenProfiles.id, profileId), eq(familyMembers.userId, userId)))
      .limit(1);

    if (!profile) {
      return res.status(404).json({ message: "Allergen profile not found" });
    }

    const [updated] = await db
      .update(allergenProfiles)
      .set({
        severity: severity || profile.profile.severity,
        diagnosedBy: diagnosedBy !== undefined ? diagnosedBy : profile.profile.diagnosedBy,
        diagnosedDate: diagnosedDate !== undefined ? diagnosedDate : profile.profile.diagnosedDate,
        notes: notes !== undefined ? notes : profile.profile.notes,
      })
      .where(eq(allergenProfiles.id, profileId))
      .returning();

    res.json({ profile: updated });
  } catch (error) {
    console.error("Error updating allergen profile:", error);
    res.status(500).json({ message: "Failed to update allergen profile" });
  }
});

// Delete allergen profile
router.delete("/profiles/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const profileId = req.params.id;

    // Get profile and verify ownership
    const [profile] = await db
      .select({
        profile: allergenProfiles,
        member: familyMembers,
      })
      .from(allergenProfiles)
      .innerJoin(familyMembers, eq(allergenProfiles.familyMemberId, familyMembers.id))
      .where(and(eq(allergenProfiles.id, profileId), eq(familyMembers.userId, userId)))
      .limit(1);

    if (!profile) {
      return res.status(404).json({ message: "Allergen profile not found" });
    }

    await db.delete(allergenProfiles).where(eq(allergenProfiles.id, profileId));

    res.json({ message: "Allergen profile deleted" });
  } catch (error) {
    console.error("Error deleting allergen profile:", error);
    res.status(500).json({ message: "Failed to delete allergen profile" });
  }
});

// ============================================================
// RECIPE & PRODUCT SAFETY CHECKS
// ============================================================

// Check if recipe is safe for all family members
router.post("/check-recipe/:recipeId", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { recipeId } = req.params;

    // Get all family members
    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, userId));

    if (members.length === 0) {
      return res.json({
        safe: true,
        message: "No family members to check",
        warnings: [],
      });
    }

    // Get all allergen profiles
    const memberIds = members.map(m => m.id);
    const profiles = await db
      .select({
        profile: allergenProfiles,
        member: familyMembers,
      })
      .from(allergenProfiles)
      .innerJoin(familyMembers, eq(allergenProfiles.familyMemberId, familyMembers.id))
      .where(inArray(allergenProfiles.familyMemberId, memberIds));

    if (profiles.length === 0) {
      return res.json({
        safe: true,
        message: "No allergens tracked",
        warnings: [],
      });
    }

    // Get recipe allergens
    const [recipeAllergenData] = await db
      .select()
      .from(recipeAllergens)
      .where(eq(recipeAllergens.recipeId, recipeId))
      .limit(1);

    const recipeAllergenList = recipeAllergenData?.allergens || [];

    // Check for matches
    const warnings: any[] = [];
    let hasSevereWarning = false;

    profiles.forEach(({ profile, member }) => {
      if (recipeAllergenList.includes(profile.allergen.toLowerCase())) {
        const isSevere = ["severe", "life-threatening"].includes(profile.severity);
        if (isSevere) hasSevereWarning = true;

        warnings.push({
          memberName: member.name,
          allergen: profile.allergen,
          severity: profile.severity,
          relationship: member.relationship,
        });
      }
    });

    res.json({
      safe: warnings.length === 0,
      hasSevereWarning,
      warnings,
      message: warnings.length === 0
        ? "This recipe is safe for all family members"
        : `Warning: This recipe contains allergens for ${warnings.length} family ${warnings.length === 1 ? "member" : "members"}`,
    });
  } catch (error) {
    console.error("Error checking recipe safety:", error);
    res.status(500).json({ message: "Failed to check recipe safety" });
  }
});

// Check if product (by barcode) is safe
router.post("/check-barcode/:barcode", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { barcode } = req.params;

    // Get all family members with allergen profiles
    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, userId));

    if (members.length === 0) {
      return res.json({
        safe: true,
        message: "No family members to check",
        warnings: [],
      });
    }

    const memberIds = members.map(m => m.id);
    const profiles = await db
      .select({
        profile: allergenProfiles,
        member: familyMembers,
      })
      .from(allergenProfiles)
      .innerJoin(familyMembers, eq(allergenProfiles.familyMemberId, familyMembers.id))
      .where(inArray(allergenProfiles.familyMemberId, memberIds));

    if (profiles.length === 0) {
      return res.json({
        safe: true,
        message: "No allergens tracked",
        warnings: [],
      });
    }

    // Get product allergens
    const [productAllergenData] = await db
      .select()
      .from(productAllergens)
      .where(eq(productAllergens.barcode, barcode))
      .limit(1);

    if (!productAllergenData) {
      return res.json({
        safe: null,
        message: "Product allergen information not available",
        warnings: [],
        note: "This product hasn't been scanned yet. Please add allergen info if available.",
      });
    }

    const productAllergenList = productAllergenData.allergens || [];
    const mayContain = productAllergenData.mayContain || [];

    // Check for matches
    const warnings: any[] = [];
    let hasSevereWarning = false;

    profiles.forEach(({ profile, member }) => {
      const hasAllergen = productAllergenList.includes(profile.allergen.toLowerCase());
      const mayHaveAllergen = mayContain.includes(profile.allergen.toLowerCase());

      if (hasAllergen || mayHaveAllergen) {
        const isSevere = ["severe", "life-threatening"].includes(profile.severity);
        if (isSevere) hasSevereWarning = true;

        warnings.push({
          memberName: member.name,
          allergen: profile.allergen,
          severity: profile.severity,
          relationship: member.relationship,
          certainty: hasAllergen ? "contains" : "may-contain",
        });
      }
    });

    res.json({
      safe: warnings.length === 0,
      hasSevereWarning,
      warnings,
      productName: productAllergenData.productName,
      message: warnings.length === 0
        ? "This product is safe for all family members"
        : `Warning: This product has allergens for ${warnings.length} family ${warnings.length === 1 ? "member" : "members"}`,
    });
  } catch (error) {
    console.error("Error checking product safety:", error);
    res.status(500).json({ message: "Failed to check product safety" });
  }
});

// Add product allergen info (when scanning a new product)
router.post("/product-allergens", requireAuth, async (req: Request, res: Response) => {
  try {
    const { barcode, productName, allergens, mayContain } = req.body;

    if (!barcode || !productName) {
      return res.status(400).json({ message: "Barcode and product name are required" });
    }

    // Check if product allergen info already exists
    const [existing] = await db
      .select()
      .from(productAllergens)
      .where(eq(productAllergens.barcode, barcode))
      .limit(1);

    if (existing) {
      // Update existing
      const [updated] = await db
        .update(productAllergens)
        .set({
          allergens: allergens || [],
          mayContain: mayContain || [],
        })
        .where(eq(productAllergens.barcode, barcode))
        .returning();

      return res.json({ productAllergen: updated });
    }

    // Insert new
    const [productAllergen] = await db
      .insert(productAllergens)
      .values({
        barcode,
        productName,
        allergens: allergens || [],
        mayContain: mayContain || [],
      })
      .returning();

    res.json({ productAllergen });
  } catch (error) {
    console.error("Error adding product allergen info:", error);
    res.status(500).json({ message: "Failed to add product allergen info" });
  }
});

// ============================================================
// SUBSTITUTION PREFERENCES
// ============================================================

// Get substitution preferences
router.get("/substitutions", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const prefs = await db
      .select()
      .from(userSubstitutionPreferences)
      .where(eq(userSubstitutionPreferences.userId, userId));

    res.json({ preferences: prefs });
  } catch (error) {
    console.error("Error fetching substitution preferences:", error);
    res.status(500).json({ message: "Failed to fetch substitution preferences" });
  }
});

// Add or update substitution preference
router.post("/substitutions", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { originalIngredient, substitutes, reason } = req.body;

    if (!originalIngredient || !substitutes || substitutes.length === 0) {
      return res.status(400).json({ message: "Original ingredient and substitutes are required" });
    }

    // Check if preference exists
    const [existing] = await db
      .select()
      .from(userSubstitutionPreferences)
      .where(
        and(
          eq(userSubstitutionPreferences.userId, userId),
          eq(userSubstitutionPreferences.originalIngredient, originalIngredient.toLowerCase().trim())
        )
      )
      .limit(1);

    if (existing) {
      // Update
      const [updated] = await db
        .update(userSubstitutionPreferences)
        .set({
          substitutes,
          reason: reason || existing.reason,
        })
        .where(eq(userSubstitutionPreferences.id, existing.id))
        .returning();

      return res.json({ preference: updated });
    }

    // Insert new
    const [pref] = await db
      .insert(userSubstitutionPreferences)
      .values({
        userId,
        originalIngredient: originalIngredient.toLowerCase().trim(),
        substitutes,
        reason: reason || null,
      })
      .returning();

    res.json({ preference: pref });
  } catch (error) {
    console.error("Error saving substitution preference:", error);
    res.status(500).json({ message: "Failed to save substitution preference" });
  }
});

// Delete substitution preference
router.delete("/substitutions/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const prefId = req.params.id;

    // Verify ownership
    const [existing] = await db
      .select()
      .from(userSubstitutionPreferences)
      .where(and(eq(userSubstitutionPreferences.id, prefId), eq(userSubstitutionPreferences.userId, userId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ message: "Substitution preference not found" });
    }

    await db.delete(userSubstitutionPreferences).where(eq(userSubstitutionPreferences.id, prefId));

    res.json({ message: "Substitution preference deleted" });
  } catch (error) {
    console.error("Error deleting substitution preference:", error);
    res.status(500).json({ message: "Failed to delete substitution preference" });
  }
});

export default router;
