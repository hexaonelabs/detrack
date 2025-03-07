export enum ActionType {
  Transfer = 'Transfer',
  BridgeCall = 'Bridge Call',
  ContractInteraction = 'Contract Interaction',
  Unknown = 'Unknown',
}

export interface TxDetail {
  type: string;
  id: string;
  attributes: Attributes;
  relationships: Relationships;
}

export interface Attributes {
  operation_type: string;
  hash: string;
  mined_at_block: number;
  mined_at: Date;
  sent_from: string;
  sent_to: string;
  status: string;
  nonce: number;
  fee: Fee;
  transfers: Transfer[];
  approvals: any[];
  application_metadata: ApplicationMetadata;
  flags: AttributesFlags;
}

export interface ApplicationMetadata {
  contract_address: string;
}

export interface Fee {
  fungible_info: FungibleInfo;
  quantity: Quantity;
  price: number;
  value: number;
}

export interface FungibleInfo {
  name: string;
  symbol: string;
  icon: Icon;
  flags: FungibleInfoFlags;
  implementations: Implementation[];
}

export interface FungibleInfoFlags {
  verified: boolean;
}

export interface Icon {
  url: string;
}

export interface Implementation {
  chain_id: string;
  address: string;
  decimals: number;
}

export interface Quantity {
  int: string;
  decimals: number;
  float: number;
  numeric: string;
}

export interface AttributesFlags {
  is_trash: boolean;
}

export interface Transfer {
  fungible_info?: FungibleInfo;
  direction?: string;
  quantity?: Quantity;
  value?: number;
  price?: number;
  sender?: string;
  recipient?: string;
}

export interface Relationships {
  chain: Chain;
}

export interface Chain {
  links: Links;
  data: Data;
}

export interface Data {
  type: string;
  id: string;
}

export interface Links {
  related: string;
}