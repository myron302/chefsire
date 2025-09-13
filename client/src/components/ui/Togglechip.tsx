import { ToggleChip, ToggleChipGroup } from "@/components/ui/toggle-chip";

function ExampleChips() {
  const [on, setOn] = React.useState(false);

  return (
    <ToggleChipGroup>
      <ToggleChip
        pressed={on}
        onPressedChange={setOn}
      >
        Vegan
      </ToggleChip>

      <ToggleChip defaultPressed>Gluten-Free</ToggleChip>
      <ToggleChip>Low-Carb</ToggleChip>
    </ToggleChipGroup>
  );
}
