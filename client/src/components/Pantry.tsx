import React, { useState, useEffect } from 'react';
import { Plus, X, Clock, Search, ChefHat } from 'lucide-react';

const Pantry = () => {
  const [pantryItems, setPantryItems] = useState([]);
  const [recipeSuggestions, setRecipeSuggestions] = useState([]);
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'produce',
    quantity: 1,
    unit: 'piece',
    expirationDate: ''
  });
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState('pantry');

  const categories = [
    'produce', 'dairy', 'meat', 'seafood', 'grains', 'spices', 
    'pantry', 'frozen', 'canned', 'beverages', 'other'
  ];

  const units = ['piece', 'cup', 'oz', 'lb', 'kg', 'g', 'ml', 'l', 'tsp', 'tbsp'];

  useEffect(() => {
    fetchPantryItems();
    fetchRecipeSuggestions();
  }, []);

  const fetchPantryItems = async () => {
    try {
      const response = await fetch('/api/pantry', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const items = await response.json();
        setPantryItems(items);
      }
    } catch (error) {
      console.error('Error fetching pantry items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipeSuggestions = async () => {
    try {
      const response = await fetch('/api/pantry/recipe-suggestions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const suggestions = await response.json();
        setRecipeSuggestions(suggestions);
      }
    } catch (error) {
      console.error('Error fetching recipe suggestions:', error);
    }
  };

  const addPantryItem = async () => {
    try {
      const response = await fetch('/api/pantry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...newItem,
          expirationDate: newItem.expirationDate ? new Date(newItem.expirationDate) : null
        })
      });

      if (response.ok) {
        const item = await response.json();
        setPantryItems([...pantryItems, item]);
        setNewItem({
          name: '',
          category: 'produce',
          quantity: 1,
          unit: 'piece',
          expirationDate: ''
        });
        setShowAddForm(false);
        fetchRecipeSuggestions(); // Refresh suggestions
      }
    } catch (error) {
      console.error('Error adding pantry item:', error);
    }
  };

  const deletePantryItem = async (itemId) => {
    try {
      const response = await fetch(`/api/pantry/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setPantryItems(pantryItems.filter(item => item.id !== itemId));
        fetchRecipeSuggestions(); // Refresh suggestions
      }
    } catch (error) {
      console.error('Error deleting pantry item:', error);
    }
  };

  const getDaysUntilExpiration = (expirationDate) => {
    if (!expirationDate) return null;
