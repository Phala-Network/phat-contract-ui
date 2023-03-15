import tw from "twin.macro";
import {
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputRightElement,
  Button,
  ButtonGroup,
} from "@chakra-ui/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { RESET } from "jotai/utils";
import { setCookie } from "cookies-next";

import {
  endpointAtom,
  PARACHAIN_ENDPOINT,
  preferedEndpointAtom,
} from "@/atoms/endpointsAtom";
import { websocketConnectionMachineAtom } from "@/features/parachain/atoms";
import EndpointAddressSelect from "./EndpointAddressSelect";
import { useEffect, useState } from "react";

export default function EndpointAddressInput({ label }: { label?: string }) {
  const [endpoint, setEndpoint] = useAtom(endpointAtom);
  const setPreferedEndpointAtom = useSetAtom(preferedEndpointAtom);
  const [machine, send] = useAtom(websocketConnectionMachineAtom);

  const [endpointMode, setEndpointMode] = useState<"switch" | "input">(
    "switch"
  );

  function connect(endpoint: string) {
    if (machine.can("RECONNECT")) {
      send({ type: "RECONNECT", data: { endpoint } });
    } else {
      send({ type: "CONNECT", data: { endpoint } });
    }
    setPreferedEndpointAtom(endpoint);
  }

  useEffect(() => {
    if (endpointMode === "switch") {
      const endpoint = PARACHAIN_ENDPOINT;
      setEndpoint(RESET);
      connect(endpoint);
    }
  }, [endpointMode]);

  return (
    <FormControl>
      <FormLabel>{label || "Khala Parachain Endpoint Address"}</FormLabel>

      {endpointMode === "switch" ? (
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
          <InputRightElement width="5.25rem">
            <ButtonGroup>
              <Button
                h="1.75rem"
                size="sm"
                onClick={() => {
                  const endpoint = PARACHAIN_ENDPOINT;
                  setEndpoint(RESET);
                  if (machine.can("RECONNECT")) {
                    send({ type: "RECONNECT", data: { endpoint } });
                  } else {
                    send({ type: "CONNECT", data: { endpoint } });
                  }
                  setPreferedEndpointAtom(endpoint);
                }}
              >
                Reset
              </Button>
            </ButtonGroup>
          </InputRightElement>
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
            setEndpointMode(endpointMode === "switch" ? "input" : "switch");
          }}
        >
          {endpointMode === "switch" ? "Custom" : "Official Testnet"}
        </Button>
      </div>
    </FormControl>
  );
}
