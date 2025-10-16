import React from 'react';
import { Card, CardContent, CardHeader, Badge, Button, Progress } from 'some-ui-library';
import { Rabbit, Leaf, Carrot } from 'lucide-react';

const SmallPetsPage = () => {
  return (
    <div>
      <section style={{ background: 'linear-gradient(to right, #A5D6A7, #66BB6A)' }}>
        <h1>Small Pets</h1>
      </section>
      <section>
        <Card>
          <CardHeader title="Rabbit Recipes" />
          <CardContent>
            {/* Rabbit recipes content */}
          </CardContent>
        </Card>
        {/* Other sections for Guinea Pigs, Hamsters, etc. */}
      </section>
    </div>
  );
};

export default SmallPetsPage;