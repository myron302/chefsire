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
    name: 'Basic',
    price: 0,
    features: {
      browseVendors: true,
      saveVendors: 10,
      messaging: false,
      budgetTools: 'basic',
      guestList: false,
      registryPage: false
    }
  },
  premium: {
    name: 'Premium',
    price: 19.99,
    trialDays: 14,
    features: {
      browseVendors: true,
      saveVendors: 'unlimited', // UPGRADE: Removes the limit of 10
      messaging: true,
      budgetTools: 'advanced',
      guestList: true,
      registryPage: true,
      aiPlanner: true, // NEW FEATURE: AI-POWERED CHECKLIST
      prioritySupport: true // NEW FEATURE: Direct access to support
    }
  }
};
