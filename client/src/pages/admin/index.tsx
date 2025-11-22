import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Trophy, Star, Zap, CheckCircle2, Plus, Trash2, Edit,
  RefreshCw, AlertCircle, Shield
} from "lucide-react";

type Quest = {
  id: string;
  slug: string;
  title: string;
  description: string;
  questType: string;
  category?: string;
  targetValue: number;
  xpReward: number;
  difficulty: string;
  isActive: boolean;
  recurringPattern?: string;
  metadata?: any;
  createdAt?: string;
};

async function fetchQuests(): Promise<Quest[]> {
  const res = await fetch('/api/quests/all', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch quests');
  const data = await res.json();
  return data.quests || [];
}

async function seedQuests() {
  const res = await fetch('/api/quests/seed', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to seed quests');
  return res.json();
}

async function deleteQuest(questId: string) {
  const res = await fetch(`/api/quests/${questId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to delete quest');
  return res.json();
}

export default function AdminQuestsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');

  const { data: quests = [], isLoading, error } = useQuery({
    queryKey: ['admin-quests'],
    queryFn: fetchQuests,
  });

  const seedMutation = useMutation({
    mutationFn: seedQuests,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-quests'] });
      alert('Quests seeded successfully!');
    },
    onError: (error: any) => {
      alert(`Failed to seed quests: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteQuest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-quests'] });
    },
    onError: (error: any) => {
      alert(`Failed to delete quest: ${error.message}`);
    },
  });

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      easy: "bg-green-100 text-green-800",
      medium: "bg-yellow-100 text-yellow-800",
      hard: "bg-red-100 text-red-800",
    };
    return colors[difficulty] || colors.easy;
  };

  const getQuestIcon = (questType: string) => {
    const icons: Record<string, typeof Trophy> = {
      make_drink: Zap,
      try_category: Star,
      use_ingredient: Star,
      social_action: Trophy,
      streak_milestone: Trophy,
    };
    const Icon = icons[questType] || Star;
    return <Icon className="h-4 w-4" />;
  };

  const filteredQuests = quests.filter(quest => {
    if (filter === 'all') return true;
    if (filter === 'active') return quest.isActive;
    if (filter === 'inactive') return !quest.isActive;
    return quest.questType === filter;
  });

  const questTypes = Array.from(new Set(quests.map(q => q.questType)));
  const stats = {
    total: quests.length,
    active: quests.filter(q => q.isActive).length,
    inactive: quests.filter(q => !q.isActive).length,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 text-red-800">
                <AlertCircle className="h-5 w-5" />
                <div>
                  <h3 className="font-semibold">Error Loading Quests</h3>
                  <p className="text-sm">{(error as Error).message}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Quest Management</h1>
          </div>
          <Button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="flex items-center gap-2"
          >
            {seedMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Seed Quests
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Quests</p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </div>
                <Trophy className="h-10 w-10 text-blue-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Active Quests</p>
                  <p className="text-3xl font-bold text-green-600">{stats.active}</p>
                </div>
                <CheckCircle2 className="h-10 w-10 text-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Inactive Quests</p>
                  <p className="text-3xl font-bold text-gray-400">{stats.inactive}</p>
                </div>
                <AlertCircle className="h-10 w-10 text-gray-400 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                onClick={() => setFilter('all')}
                size="sm"
              >
                All ({quests.length})
              </Button>
              <Button
                variant={filter === 'active' ? 'default' : 'outline'}
                onClick={() => setFilter('active')}
                size="sm"
              >
                Active ({stats.active})
              </Button>
              <Button
                variant={filter === 'inactive' ? 'default' : 'outline'}
                onClick={() => setFilter('inactive')}
                size="sm"
              >
                Inactive ({stats.inactive})
              </Button>
              {questTypes.map(type => (
                <Button
                  key={type}
                  variant={filter === type ? 'default' : 'outline'}
                  onClick={() => setFilter(type)}
                  size="sm"
                >
                  {type.replace(/_/g, ' ')}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quests List */}
        <div className="space-y-4">
          {filteredQuests.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No quests found. Click "Seed Quests" to get started.</p>
              </CardContent>
            </Card>
          ) : (
            filteredQuests.map(quest => (
              <Card key={quest.id} className={!quest.isActive ? 'opacity-50' : ''}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getQuestIcon(quest.questType)}
                        <h3 className="font-semibold text-lg">{quest.title}</h3>
                        <Badge className={getDifficultyColor(quest.difficulty)}>
                          {quest.difficulty}
                        </Badge>
                        {!quest.isActive && (
                          <Badge variant="outline" className="text-gray-500">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-gray-600 mb-3">{quest.description}</p>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        <span>Type: <strong>{quest.questType}</strong></span>
                        {quest.category && <span>Category: <strong>{quest.category}</strong></span>}
                        <span>Target: <strong>{quest.targetValue}</strong></span>
                        <span>XP: <strong>{quest.xpReward}</strong></span>
                        {quest.recurringPattern && (
                          <span>Pattern: <strong>{quest.recurringPattern}</strong></span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteMutation.mutate(quest.id)}
                        disabled={deleteMutation.isPending}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
