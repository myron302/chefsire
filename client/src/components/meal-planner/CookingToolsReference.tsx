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
    </div>
  );
}
