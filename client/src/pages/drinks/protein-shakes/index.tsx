import React from 'react';
import { Link } from 'wouter';

export default function ProteinShakesHub() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-4xl font-bold mb-8">Protein Shakes Hub - TEST</h1>
      
      <div className="space-y-4">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-2xl font-bold mb-2">Category Links:</h2>
          <ul className="space-y-2">
            <li>
              <Link href="/drinks/protein-shakes/whey">
                <a className="text-blue-600 hover:underline">→ Whey Protein</a>
              </Link>
            </li>
            <li>
              <Link href="/drinks/protein-shakes/plant-based">
                <a className="text-blue-600 hover:underline">→ Plant-Based Protein</a>
              </Link>
            </li>
            <li>
              <Link href="/drinks/protein-shakes/casein">
                <a className="text-blue-600 hover:underline">→ Casein Protein</a>
              </Link>
            </li>
            <li>
              <Link href="/drinks/protein-shakes/collagen">
                <a className="text-blue-600 hover:underline">→ Collagen Protein</a>
              </Link>
            </li>
            <li>
              <Link href="/drinks/protein-shakes/workout">
                <a className="text-blue-600 hover:underline">→ Pre/Post Workout</a>
              </Link>
            </li>
            <li>
              <Link href="/drinks/smoothies/protein">
                <a className="text-blue-600 hover:underline">→ High-Protein Smoothies</a>
              </Link>
            </li>
          </ul>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-bold mb-2">Debug Info:</h2>
          <p>If you see this page, the route is working!</p>
          <p>Current path: /drinks/protein-shakes</p>
        </div>
      </div>
    </div>
  );
}
