export const vendorPlans = {
  free: {
    name: 'Basic',
    price: 0,
    features: {
      listings: 1,
      photos: 5,
      monthlyLeads: 3,
      commission: 0.25,
      messaging: false,
      analytics: false,
      featuredPlacement: false
    }
  },
  professional: {
    name: 'Professional',
    price: 99,
    features: {
      listings: 3,
      photos: 20,
      monthlyLeads: 50,
      commission: 0.15,
      messaging: true,
      analytics: true,
      featuredPlacement: false
    }
  },
  premium: {
    name: 'Premium',
    price: 299,
    features: {
      listings: 'unlimited',
      photos: 'unlimited',
      monthlyLeads: 'unlimited',
      commission: 0.10,
      messaging: true,
      analytics: true,
      featuredPlacement: true,
      prioritySupport: true
    }
  }
};

export const couplePlans = {
  free: {
    name: 'Free',
    price: 0,
    tier: 'free' as const,
    features: {
      browseVendors: true,
      saveVendors: 10,
      messaging: false,
      budgetTools: 'basic',
      guestList: false,
      guestLimit: 0,
      registryPage: false,
      rsvpTracking: false,
      emailInvitations: false,
      aiPlanner: false,
      dynamicBudget: false,
      prioritySupport: false,
      dedicatedCoordinator: false
    },
    description: 'Essential tools to start planning',
    highlights: [
      'Browse unlimited vendors',
      'Save up to 10 vendors',
      'Basic budget calculator',
      'Planning checklist'
    ]
  },
  premium: {
    name: 'Premium',
    price: 24.99,
    tier: 'premium' as const,
    trialDays: 14,
    popular: true,
    features: {
      browseVendors: true,
      saveVendors: 'unlimited',
      messaging: true,
      budgetTools: 'advanced',
      guestList: true,
      guestLimit: 150,
      registryPage: true,
      rsvpTracking: true,
      emailInvitations: true,
      aiPlanner: false,
      dynamicBudget: false,
      prioritySupport: false,
      dedicatedCoordinator: false
    },
    description: 'Complete wedding planning suite',
    highlights: [
      'Unlimited saved vendors',
      'Guest list up to 150',
      'Email invitations & RSVP tracking',
      'Registry hub with sharing',
      'Vendor messaging',
      'Planning calendar'
    ]
  },
  elite: {
    name: 'Elite',
    price: 49.99,
    tier: 'elite' as const,
    trialDays: 14,
    features: {
      browseVendors: true,
      saveVendors: 'unlimited',
      messaging: true,
      budgetTools: 'ai-powered',
      guestList: true,
      guestLimit: 'unlimited',
      registryPage: true,
      rsvpTracking: true,
      emailInvitations: true,
      aiPlanner: true,
      dynamicBudget: true,
      prioritySupport: true,
      dedicatedCoordinator: true,
      customWebsite: true
    },
    description: 'VIP experience with white-glove service',
    highlights: [
      'Everything in Premium',
      'Unlimited guests',
      'AI Wedding Planner',
      'Dynamic budget optimizer',
      'Priority vendor responses (2x faster)',
      'Dedicated wedding coordinator',
      'Custom wedding website',
      'Advanced analytics'
    ]
  }
};

