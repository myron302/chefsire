import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Home from './Home';
import About from './About';
import PetFoodHub from './PetFoodHub'; // Importing PetFoodHub

const App = () => {
  return (
    <Router>
      <Switch>
        <Route path='/' exact component={Home} />
        <Route path='/about' component={About} />
        <Route path='/pet-food-hub' component={PetFoodHub} /> {/* Route for PetFoodHub */}
      </Switch>
    </Router>
  );
};

export default App;