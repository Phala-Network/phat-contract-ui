import tw from "twin.macro";
import {
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  Button,
} from "@chakra-ui/react";
import { useAtom, useSetAtom } from "jotai";
import { RESET } from "jotai/utils";

import {
  endpointAtom,
  PARACHAIN_ENDPOINT,
  preferedEndpointAtom,
  switchModeAtom,
} from "@/atoms/endpointsAtom";
import { websocketConnectionMachineAtom } from "@/features/parachain/atoms";
import EndpointAddressSelect from "./EndpointAddressSelect";

export default function EndpointAddressInput({ label }: { label?: string }) {
  const [endpoint, setEndpoint] = useAtom(endpointAtom);
  const setPreferedEndpointAtom = useSetAtom(preferedEndpointAtom);
  const [machine, send] = useAtom(websocketConnectionMachineAtom);

  const [switchMode, setSwitchMode] = useAtom(switchModeAtom);
  
  function connect(endpoint: string) {
    if (machine.can("RECONNECT")) {
      send({ type: "RECONNECT", data: { endpoint } });
    } else {
      send({ type: "CONNECT", data: { endpoint } });
    }
    setPreferedEndpointAtom(endpoint);
  }

  return (
    <FormControl>
      <FormLabel>{label || "Khala Parachain Endpoint Address"}</FormLabel>

      {switchMode === "switch" ? (
        <EndpointAddressSelect
          value={endpoint}
          onChange={(value) => {
            setEndpoint(value);
            connect(value);
          }}
        />
      ) : (
        <InputGroup>
          <Input
            type="url"
            value={endpoint}
            onChange={(ev) => setEndpoint(ev.target.value)}
          />
        </InputGroup>
      )}
      <div tw="mt-2 flex flex-row gap-2">
        <Button
          h="1.75rem"
          tw="mr-[5px]"
          size="sm"
          disabled={machine.matches("connecting")}
          onClick={() => {
            connect(endpoint);
          }}
        >
          Connect
        </Button>
        <Button
          h="1.75rem"
          size="sm"
          disabled={machine.matches("disconnected")}
          onClick={() => {
            send({ type: "DISCONNECTED" });
          }}
        >
          Disconnect
        </Button>
        <Button
          h="1.75rem"
          size="sm"
          disabled={machine.matches("connecting")}
          onClick={() => {
            if (switchMode === 'input') {
              const endpoint = PARACHAIN_ENDPOINT;
              setEndpoint(endpoint);
              connect(endpoint);
            }
            setSwitchMode(switchMode === "switch" ? "input" : "switch");
          }}
        >
          {switchMode === "switch" ? "Custom" : "Official Testnet"}
        </Button>
      </div>
    </FormControl>
  );
}
