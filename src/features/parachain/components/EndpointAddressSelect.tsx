import { Select } from "@chakra-ui/react";
import { Atom, useAtom, WritableAtom } from "jotai";

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
      <option>wss://poc5.phala.network/ws</option>
      <option>wss://phat-beta-node.phala.network/khala/ws</option>
    </Select>
  );
}
