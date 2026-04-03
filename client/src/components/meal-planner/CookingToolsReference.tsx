import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const volumeEquivalents = [
  { measure: "Dash / pinch", teaspoons: "< 1/8 tsp", tablespoons: "—", fluidOunces: "0.01 fl oz", cups: "—", metric: "0.5 mL" },
  { measure: "1/4 tsp", teaspoons: "1/4 tsp", tablespoons: "1/12 tbsp", fluidOunces: "0.03 fl oz", cups: "—", metric: "1 mL" },
  { measure: "1/2 tsp", teaspoons: "1/2 tsp", tablespoons: "1/6 tbsp", fluidOunces: "0.06 fl oz", cups: "—", metric: "2 mL" },
  { measure: "1 tsp", teaspoons: "1 tsp", tablespoons: "1/3 tbsp", fluidOunces: "0.15 fl oz", cups: "—", metric: "5 mL" },
  { measure: "1 tbsp", teaspoons: "3 tsp", tablespoons: "1 tbsp", fluidOunces: "0.5 fl oz", cups: "1/16 cup", metric: "15 mL" },
  { measure: "1 fluid ounce", teaspoons: "6 tsp", tablespoons: "2 tbsp", fluidOunces: "1 fl oz", cups: "1/8 cup", metric: "30 mL" },
  { measure: "1 cup", teaspoons: "48 tsp", tablespoons: "16 tbsp", fluidOunces: "8 fl oz", cups: "1 cup", metric: "250 mL" },
  { measure: "1 pint", teaspoons: "96 tsp", tablespoons: "32 tbsp", fluidOunces: "16 fl oz", cups: "2 cups", metric: "500 mL" },
  { measure: "1 quart", teaspoons: "192 tsp", tablespoons: "64 tbsp", fluidOunces: "32 fl oz", cups: "4 cups", metric: "1,000 mL" },
  { measure: "1 gallon", teaspoons: "768 tsp", tablespoons: "256 tbsp", fluidOunces: "128 fl oz", cups: "16 cups", metric: "4,000 mL" },
];

const weightEquivalents = [
  { ounces: "1 oz", pounds: "—", grams: "30 g", kilograms: "—" },
  { ounces: "3.5 oz", pounds: "~1/4 lb", grams: "100 g", kilograms: "—" },
  { ounces: "8 oz", pounds: "1/2 lb", grams: "250 g", kilograms: "0.25 kg" },
  { ounces: "16 oz", pounds: "1 lb", grams: "500 g", kilograms: "0.5 kg" },
  { ounces: "24 oz", pounds: "1 1/2 lb", grams: "750 g", kilograms: "0.75 kg" },
  { ounces: "32 oz", pounds: "2 lb", grams: "1,000 g", kilograms: "1 kg" },
  { ounces: "48 oz", pounds: "3 lb", grams: "1,500 g", kilograms: "1.5 kg" },
  { ounces: "64 oz", pounds: "4 lb", grams: "2,000 g", kilograms: "2 kg" },
];

const metricFormulas = [
  { from: "Teaspoon", multiplyBy: "4.93", to: "Milliliter" },
  { from: "Tablespoon", multiplyBy: "14.79", to: "Milliliter" },
  { from: "Fluid ounce", multiplyBy: "29.57", to: "Milliliter" },
  { from: "Cup", multiplyBy: "236.59", to: "Milliliter" },
  { from: "Cup", multiplyBy: "0.236", to: "Liter" },
  { from: "Pint", multiplyBy: "473.18", to: "Milliliter" },
  { from: "Pint", multiplyBy: "0.473", to: "Liter" },
  { from: "Quart", multiplyBy: "946.36", to: "Milliliter" },
  { from: "Gallon", multiplyBy: "3.785", to: "Liter" },
  { from: "Ounce", multiplyBy: "28.35", to: "Gram" },
  { from: "Pound", multiplyBy: "0.454", to: "Kilogram" },
  { from: "Inch", multiplyBy: "2.54", to: "Centimeter" },
];

const panCapacityReference = [
  { panSize: '1 3/4-by 3/4-inch (4.5 by 2 cm)', panType: 'Mini muffin or madeleine cup', approxVolume: '2 tbsp (30 mL)' },
  { panSize: '5-by 1 3/8-by 3/8-inch (12.5 by 3.4 by 1 cm)', panType: 'Cornstick pan / barquette shell / ladyfinger cup', approxVolume: '3 1/2 tbsp (52 mL)' },
  { panSize: '2 3/4-by 1 1/8-inch (7 by 2.8 cm)', panType: 'Muffin cup', approxVolume: '1/4 cup (60 mL)' },
  { panSize: '2 3/4-by 1 3/8-inch (7 by 3.4 cm)', panType: 'Deep muffin or popover cup', approxVolume: '7 tbsp (105 mL)' },
  { panSize: '3-by 1 1/4-inch (7.5 by 3 cm)', panType: 'Jumbo muffin cup', approxVolume: '10 tbsp (150 mL)' },
  { panSize: '3 1/2-by 1 3/4-inch (8.5 by 4.5 cm)', panType: 'Round ramekin or custard cup', approxVolume: '3/4 cup (175 mL)' },
  { panSize: '5 1/2-by 3-by 2-inch (14 by 7.5 by 6 cm)', panType: 'Loaf', approxVolume: '2 cups (500 mL)' },
  { panSize: '1 quart (1 L)', panType: 'Casserole', approxVolume: '4 cups (1 L)' },
  { panSize: '8-by 1 1/2-inch (20 by 4 cm)', panType: 'Pie, quiche, round cake', approxVolume: '4 cups (1 L)' },
  { panSize: '11-by 1-inch (27.5 by 2.5 cm)', panType: 'Tart or quiche', approxVolume: '4 cups (1 L)' },
  { panSize: '9-by 1 1/2-inch (23 by 4 cm)', panType: 'Pie, quiche, round cake', approxVolume: '5 cups (1.25 L)' },
  { panSize: '7 1/2-by 3-inch (19 by 7.5 cm)', panType: 'Bundt or Kugelhopf', approxVolume: '6 cups (1.5 L)' },
  { panSize: '8-by 2-inch (20 by 5 cm)', panType: 'Round cake', approxVolume: '6 cups (1.5 L)' },
  { panSize: '8-by 8-by 1 1/2-inch (20 by 20 by 4 cm)', panType: 'Square', approxVolume: '6 cups (1.5 L)' },
  { panSize: '10-by 1 1/2-inch (25 by 4 cm)', panType: 'Pie or quiche', approxVolume: '6 cups (1.5 L)' },
  { panSize: '11-by 7-by 2-inch (27.5 by 18 by 5 cm)', panType: 'Rectangular', approxVolume: '6 cups (1.5 L)' },
  { panSize: '8 1/2-by 4 1/2-by 2 1/4-inch (21 by 11 by 6 cm)', panType: 'Loaf', approxVolume: '6 cups (1.5 L)' },
  { panSize: '6-by 4 1/4-inch (15 by 10.5 cm)', panType: 'Charlotte / panettone / round mold', approxVolume: '7 1/2 cups (1.875 L)' },
  { panSize: '2 quart (2 L)', panType: 'Casserole', approxVolume: '8 cups (2 L)' },
  { panSize: '8-by 8-by 2-inch (20 by 20 by 5 cm)', panType: 'Square', approxVolume: '8 cups (2 L)' },
  { panSize: '9-by 2-inch (23 by 5 cm)', panType: 'Deep-dish pie / quiche / round cake', approxVolume: '8 cups (2 L)' },
  { panSize: '9-by 5-by 3-inch (23 by 12.5 by 7.5 cm)', panType: 'Loaf', approxVolume: '8 cups (2 L)' },
  { panSize: '9 1/2-by 2 1/2-inch (24 by 6 cm)', panType: 'Springform', approxVolume: '10 cups (2.5 L)' },
  { panSize: '15-by 10-by 1-inch (38 by 25 by 2.5 cm)', panType: 'Jelly roll', approxVolume: '10 cups (2.5 L)' },
  { panSize: '10-by 2-inch (25 by 5 cm)', panType: 'Round cake', approxVolume: '11 cups (2.75 L)' },
  { panSize: '10-by 2 1/2-inch (25 by 6 cm)', panType: 'Springform', approxVolume: '12 cups (3 L)' },
  { panSize: '10-by 3 1/2-inch (25 by 8.5 cm)', panType: 'Bundt', approxVolume: '12 cups (3 L)' },
  { panSize: '3 quart (3 L)', panType: 'Casserole', approxVolume: '12 cups (3 L)' },
  { panSize: '13-by 9-by 2-inch (33 by 23 by 5 cm)', panType: 'Rectangular', approxVolume: '12 cups (3 L)' },
  { panSize: '10-by 4-inch (25 by 10 cm)', panType: 'Tube', approxVolume: '16 cups (4 L)' },
  { panSize: '14-by 10 1/2-by 2 1/2-inch (35 by 26 by 6 cm)', panType: 'Roasting pan', approxVolume: '18 cups (4.5 L)' },
  { panSize: '10-by 5-inch (25 by 12.5 cm)', panType: 'Round cloche clay oven', approxVolume: '20 cups (5 L)' },
];

export default function CookingToolsReference() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Volume Equivalents</CardTitle>
          <CardDescription>
            Practical rounded conversions for everyday cooking and baking.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descriptive Measure</TableHead>
                <TableHead>Teaspoons</TableHead>
                <TableHead>Tablespoons</TableHead>
                <TableHead>Fluid Ounces</TableHead>
                <TableHead>Cups</TableHead>
                <TableHead>Metric (rounded)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {volumeEquivalents.map((row) => (
                <TableRow key={row.measure}>
                  <TableCell className="font-medium">{row.measure}</TableCell>
                  <TableCell>{row.teaspoons}</TableCell>
                  <TableCell>{row.tablespoons}</TableCell>
                  <TableCell>{row.fluidOunces}</TableCell>
                  <TableCell>{row.cups}</TableCell>
                  <TableCell>{row.metric}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Weight Equivalents</CardTitle>
            <CardDescription>Common U.S. imperial to metric cooking weights.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ounces</TableHead>
                  <TableHead>Pounds</TableHead>
                  <TableHead>Grams</TableHead>
                  <TableHead>Kilograms</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weightEquivalents.map((row) => (
                  <TableRow key={row.ounces}>
                    <TableCell className="font-medium">{row.ounces}</TableCell>
                    <TableCell>{row.pounds}</TableCell>
                    <TableCell>{row.grams}</TableCell>
                    <TableCell>{row.kilograms}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Precise Metric Formulas</CardTitle>
            <CardDescription>For exact conversions, multiply by the values below.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Convert From</TableHead>
                  <TableHead>Multiply By</TableHead>
                  <TableHead>To Determine</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metricFormulas.map((row) => (
                  <TableRow key={`${row.from}-${row.to}`}>
                    <TableCell className="font-medium">{row.from}</TableCell>
                    <TableCell>{row.multiplyBy}</TableCell>
                    <TableCell>{row.to}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pan Size & Filled Volume Guide</CardTitle>
          <CardDescription>
            Approximate capacities for common baking pans and molds.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pan Size</TableHead>
                <TableHead>Pan Type</TableHead>
                <TableHead>Approximate Filled Volume</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {panCapacityReference.map((row) => (
                <TableRow key={`${row.panSize}-${row.panType}`}>
                  <TableCell className="font-medium">{row.panSize}</TableCell>
                  <TableCell>{row.panType}</TableCell>
                  <TableCell>{row.approxVolume}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
