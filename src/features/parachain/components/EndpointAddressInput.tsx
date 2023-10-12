import React from 'react';
import tw from "twin.macro";
import {
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  Button,
  ButtonGroup,
  Tag,
} from "@chakra-ui/react";
import { useAtom, useSetAtom } from "jotai";

import {
  endpointAtom,
  preferedEndpointAtom,
} from "@/atoms/endpointsAtom";
import { websocketConnectionMachineAtom } from "@/features/parachain/atoms";
import Code from "@/components/code";

export default function EndpointAddressInput({ label }: { label?: string }) {
  const [endpoint, setEndpoint] = useAtom(endpointAtom);
  const setPreferedEndpointAtom = useSetAtom(preferedEndpointAtom);
  const [machine, send] = useAtom(websocketConnectionMachineAtom);

  function connect(endpoint: string) {
    if (machine.can("RECONNECT")) {
      send({ type: "RECONNECT", data: { endpoint } });
    } else {
      send({ type: "CONNECT", data: { endpoint } });
    }
    setPreferedEndpointAtom(endpoint);
  }

  return (
    <>
      <FormControl>
        <FormLabel>{label || "Khala Parachain Endpoint Address"}</FormLabel>
        <div tw="flex flex-col gap-2">
          <InputGroup tw="flex flex-row items-center">
            <Input
              size="sm"
              type="url"
              value={endpoint}
              onChange={(ev) => setEndpoint(ev.target.value)}
            />
            <ButtonGroup ml="2">
              <Button
                size="xs"
                isDisabled={machine.matches("connecting")}
                onClick={() => {
                  connect(endpoint);
                }}
              >
                Connect
              </Button>
              <Button
                size="xs"
                isDisabled={machine.matches("disconnected")}
                onClick={() => {
                  send({ type: "DISCONNECTED" });
                }}
              >
                Disconnect
              </Button>
            </ButtonGroup>
          </InputGroup>
          <div tw="flex flex-row justify-between items-center">
            <div tw="flex flex-row items-center gap-1">
              <span tw="min-w-[7ch] inline-flex items-center">
                <Tag size="sm" colorScheme="phalaDark" variant="solid">mainnet</Tag>
              </span>
              <Code>api.phala.network</Code>
            </div>
            <Button
              size="xs"
              isDisabled={endpoint === 'wss://api.phala.network/ws'}
              onClick={() => connect('wss://api.phala.network/ws')}
            >
              {endpoint === 'wss://api.phala.network/ws' ? 'connected' : 'connect'}
            </Button>
          </div>
          <div tw="flex flex-row justify-between items-center">
            <div tw="flex flex-row items-center gap-1">
              <span tw="min-w-[7ch] inline-flex items-center">
                <Tag size="sm" colorScheme="orange" variant="solid">testnet</Tag>
              </span>
              <Code>poc6.phala.network</Code>
            </div>
            <Button
              size="xs"
              isDisabled={endpoint === 'wss://poc6.phala.network/ws'}
              onClick={() => connect('wss://poc6.phala.network/ws')}
            >
              {endpoint === 'wss://poc6.phala.network/ws' ? 'connected' : 'connect'}
            </Button>
          </div>
          <div tw="flex flex-row justify-between items-center">
            <div tw="flex flex-row items-center gap-1">
              <span tw="min-w-[7ch] inline-flex gap-1 items-center">
                <Tag size="sm" colorScheme="orange" variant="solid">testnet</Tag>
                <Tag size="sm" colorScheme="yellow" variant="solid">deprecated</Tag>
              </span>
              <Code>poc5.phala.network</Code>
            </div>
            <Button
              size="xs"
              isDisabled={endpoint === 'wss://poc5.phala.network/ws'}
              onClick={() => connect('wss://poc5.phala.network/ws')}
            >
              {endpoint === 'wss://poc5.phala.network/ws' ? 'connected' : 'connect'}
            </Button>
          </div>
        </div>
      </FormControl>
    </>
  );
}
