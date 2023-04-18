import { Select } from "@chakra-ui/react";

export const options = [
  'wss://pc-test-3.phala.network/khala/ws',
  'wss://poc5.phala.network/ws',
]

export default function EndpointAddressSelect({
  onChange,
  value,
}: {
  onChange: (s: string) => void;
  value: string;
}) {
  return (
    <Select
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
      }}
    >
      {
        options.map(o => {
          return <option key={o}>{o}</option>
        })
      }
    </Select>
  );
}
