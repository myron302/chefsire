import React, { useState } from 'react';
import {
  User,
  Lock,
  Shield,
  Bell,
  Tag,
  Trash2,
  Save,
  Upload,
  Eye,
  EyeOff,
  Building2,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/contexts/UserContext';

const FOOD_CATEGORIES = [
  'Italian', 'Mexican', 'Chinese', 'Japanese', 'Thai',
  'Indian', 'French', 'Mediterranean', 'American', 'BBQ',
  'Vegan', 'Vegetarian', 'Gluten-Free', 'Keto', 'Paleo',
  'Desserts', 'Baking', 'Seafood', 'Breakfast', 'Appetizers',
  'Soups', 'Salads'
];

export default function SettingsPage() {
  const { user } = useUser();
  const [profile, setProfile] = useState({
    username: user?.username || '',
    displayName: user?.displayName || '',
    bio: user?.bio || '',
    avatar: user?.avatar || '',
  });

  const [accountType, setAccountType] = useState<'personal' | 'business'>(
    user?.isChef ? 'business' : 'personal'
  );

  const [businessInfo, setBusinessInfo] = useState({
    businessName: '',
    businessCategory: '',
  });

  const [password, setPassword] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [privacy, setPrivacy] = useState({
    profilePublic: true,
    showEmail: false,
    allowMessages: true,
  });

  const [notifications, setNotifications] = useState({
    emailLikes: true,
    emailComments: true,
    emailFollows: true,
    emailMessages: true,
    emailNewsletter: false,
    pushEnabled: true,
  });

  const [interests, setInterests] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getPasswordStrength = (password: string): { strength: number; label: string; color: string } => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 1) return { strength: 20, label: 'Weak', color: 'bg-red-500' };
    if (strength <= 3) return { strength: 50, label: 'Fair', color: 'bg-yellow-500' };
    if (strength <= 4) return { strength: 75, label: 'Good', color: 'bg-blue-500' };
    return { strength: 100, label: 'Strong', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(password.new);

  const toggleInterest = (category: string) => {
    setInterests(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleSaveProfile = () => {
    // TODO: API call to save profile
    console.log('Saving profile:', profile);
  };

  const handleChangePassword = () => {
    if (password.new !== password.confirm) {
      alert('New passwords do not match');
      return;
    }
    // TODO: API call to change password
    console.log('Changing password');
  };

  const handleDeleteAccount = () => {
    if (window.confirm('Are you absolutely sure? This action cannot be undone.')) {
      // TODO: API call to delete account
      console.log('Deleting account');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="interests">Interests</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>Update your profile information and avatar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar */}
                <div>
                  <Label>Profile Picture</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                      {profile.avatar ? (
                        <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User size={32} className="text-gray-400" />
                      )}
                    </div>
                    <Button variant="outline">
                      <Upload size={16} className="mr-2" />
                      Upload Photo
                    </Button>
                  </div>
                </div>

                {/* Username */}
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={profile.username}
                    onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                  />
                </div>

                {/* Display Name */}
                <div>
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={profile.displayName}
                    onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                  />
                </div>

                {/* Bio */}
                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    rows={4}
                    placeholder="Tell us about yourself..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {profile.bio.length}/500 characters
                  </p>
                </div>

                <Button onClick={handleSaveProfile} className="bg-orange-500 hover:bg-orange-600">
                  <Save size={16} className="mr-2" />
                  Save Profile
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle>Account Type</CardTitle>
                <CardDescription>Switch between personal and business account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Account Type Switcher */}
                <div className="grid grid-cols-2 gap-4">
                  <Card
                    className={`cursor-pointer transition-all ${
                      accountType === 'personal' ? 'ring-2 ring-orange-500' : ''
                    }`}
                    onClick={() => setAccountType('personal')}
                  >
                    <CardContent className="pt-6">
                      <User className="mb-3 text-blue-500" size={24} />
                      <h3 className="font-semibold mb-2">Personal</h3>
                      <p className="text-sm text-gray-600">
                        For individual food enthusiasts and home cooks
                      </p>
                    </CardContent>
                  </Card>

                  <Card
                    className={`cursor-pointer transition-all ${
                      accountType === 'business' ? 'ring-2 ring-orange-500' : ''
                    }`}
                    onClick={() => setAccountType('business')}
                  >
                    <CardContent className="pt-6">
                      <Building2 className="mb-3 text-orange-500" size={24} />
                      <h3 className="font-semibold mb-2">Business</h3>
                      <p className="text-sm text-gray-600">
                        For chefs, caterers, and food businesses
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Business Info (conditional) */}
                {accountType === 'business' && (
                  <div className="space-y-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <h4 className="font-semibold">Business Information</h4>
                    <div>
                      <Label htmlFor="businessName">Business Name</Label>
                      <Input
                        id="businessName"
                        value={businessInfo.businessName}
                        onChange={(e) => setBusinessInfo({ ...businessInfo, businessName: e.target.value })}
                        placeholder="Your Business Name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="businessCategory">Category</Label>
                      <Input
                        id="businessCategory"
                        value={businessInfo.businessCategory}
                        onChange={(e) => setBusinessInfo({ ...businessInfo, businessCategory: e.target.value })}
                        placeholder="e.g., Catering, Restaurant, Bakery"
                      />
                    </div>
                  </div>
                )}

                {/* Business Benefits */}
                {accountType === 'business' && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-6">
                      <h4 className="font-semibold mb-3">Business Account Benefits:</h4>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                          <Check size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                          <span>Create and manage your online store</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                          <span>Offer catering services to customers</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                          <span>Access business analytics and insights</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Check size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                          <span>Verified business badge</span>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                )}

                <Button className="bg-orange-500 hover:bg-orange-600">
                  <Save size={16} className="mr-2" />
                  Save Account Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Password Tab */}
          <TabsContent value="password">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your password to keep your account secure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Password */}
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showPasswords.current ? 'text' : 'password'}
                      value={password.current}
                      onChange={(e) => setPassword({ ...password, current: e.target.value })}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                    >
                      {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPasswords.new ? 'text' : 'password'}
                      value={password.new}
                      onChange={(e) => setPassword({ ...password, new: e.target.value })}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                    >
                      {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Password Strength Meter */}
                  {password.new && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>Password Strength:</span>
                        <span className="font-semibold">{passwordStrength.label}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${passwordStrength.color}`}
                          style={{ width: `${passwordStrength.strength}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={password.confirm}
                      onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                    >
                      {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {password.confirm && password.new !== password.confirm && (
                    <p className="text-red-500 text-sm mt-1">Passwords do not match</p>
                  )}
                </div>

                <Button onClick={handleChangePassword} className="bg-orange-500 hover:bg-orange-600">
                  <Lock size={16} className="mr-2" />
                  Change Password
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy">
            <Card>
              <CardHeader>
                <CardTitle>Privacy Settings</CardTitle>
                <CardDescription>Control who can see your information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                  {
                    key: 'profilePublic',
                    label: 'Public Profile',
                    description: 'Allow anyone to view your profile and posts',
                  },
                  {
                    key: 'showEmail',
                    label: 'Show Email',
                    description: 'Display your email address on your profile',
                  },
                  {
                    key: 'allowMessages',
                    label: 'Allow Messages',
                    description: 'Let other users send you direct messages',
                  },
                ].map((setting) => (
                  <div key={setting.key} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">{setting.label}</div>
                      <div className="text-sm text-gray-600">{setting.description}</div>
                    </div>
                    <Button
                      variant={privacy[setting.key as keyof typeof privacy] ? 'default' : 'outline'}
                      onClick={() => setPrivacy({ ...privacy, [setting.key]: !privacy[setting.key as keyof typeof privacy] })}
                    >
                      {privacy[setting.key as keyof typeof privacy] ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                ))}

                <Button className="bg-orange-500 hover:bg-orange-600">
                  <Save size={16} className="mr-2" />
                  Save Privacy Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose what notifications you want to receive</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-4">Email Notifications</h4>
                  <div className="space-y-4">
                    {[
                      { key: 'emailLikes', label: 'Likes on your posts' },
                      { key: 'emailComments', label: 'Comments on your posts' },
                      { key: 'emailFollows', label: 'New followers' },
                      { key: 'emailMessages', label: 'Direct messages' },
                      { key: 'emailNewsletter', label: 'Newsletter and updates' },
                    ].map((setting) => (
                      <div key={setting.key} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>{setting.label}</div>
                        <Button
                          variant={notifications[setting.key as keyof typeof notifications] ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setNotifications({ ...notifications, [setting.key]: !notifications[setting.key as keyof typeof notifications] })}
                        >
                          {notifications[setting.key as keyof typeof notifications] ? 'On' : 'Off'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-4">Push Notifications</h4>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>Enable push notifications</div>
                    <Button
                      variant={notifications.pushEnabled ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setNotifications({ ...notifications, pushEnabled: !notifications.pushEnabled })}
                    >
                      {notifications.pushEnabled ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                </div>

                <Button className="bg-orange-500 hover:bg-orange-600">
                  <Save size={16} className="mr-2" />
                  Save Notification Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Interests Tab */}
          <TabsContent value="interests">
            <Card>
              <CardHeader>
                <CardTitle>Food Interests</CardTitle>
                <CardDescription>
                  Select your favorite food categories to personalize your experience
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  {FOOD_CATEGORIES.map((category) => (
                    <Badge
                      key={category}
                      variant={interests.includes(category) ? 'default' : 'outline'}
                      className={`cursor-pointer px-4 py-2 ${
                        interests.includes(category)
                          ? 'bg-orange-500 hover:bg-orange-600'
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={() => toggleInterest(category)}
                    >
                      <Tag size={14} className="mr-1" />
                      {category}
                    </Badge>
                  ))}
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm">
                    <strong>Selected:</strong> {interests.length} categories
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    We'll use your interests to recommend relevant content and recipes
                  </p>
                </div>

                <Button className="bg-orange-500 hover:bg-orange-600">
                  <Save size={16} className="mr-2" />
                  Save Interests
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Danger Zone */}
        <Card className="border-red-200 mt-8">
          <CardHeader>
            <CardTitle className="text-red-600">Danger Zone</CardTitle>
            <CardDescription>Irreversible and destructive actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
              <div>
                <div className="font-semibold text-red-600">Delete Account</div>
                <div className="text-sm text-gray-600">
                  Permanently delete your account and all associated data
                </div>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 size={16} className="mr-2" />
                Delete Account
              </Button>
            </div>

            {showDeleteConfirm && (
              <div className="mt-4 p-4 border-2 border-red-500 rounded-lg bg-red-50">
                <div className="flex items-start gap-3 mb-4">
                  <AlertTriangle className="text-red-600 flex-shrink-0" size={24} />
                  <div>
                    <p className="font-semibold text-red-600 mb-2">
                      Are you absolutely sure?
                    </p>
                    <p className="text-sm text-gray-700">
                      This action cannot be undone. This will permanently delete your account,
                      remove your profile, and delete all your posts and data.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                  >
                    Yes, Delete My Account
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
