import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  TokenCreated,
  TransferRequested,
  TransferAccepted,
  TransferRejected,
  TransferCancelled,
  UserRoleRequested,
  SupplyChain
} from "../generated/SupplyChain/SupplyChain"
import { Token, Transfer, User, TokenInput } from "../generated/schema"

export function handleTokenCreated(event: TokenCreated): void {
  let token = new Token(event.params.tokenId.toString())
  
  token.tokenId = event.params.tokenId
  token.creator = event.params.creator
  token.name = event.params.name
  token.description = event.params.description
  token.totalSupply = event.params.totalSupply
  token.features = event.params.features
  token.parentId = event.params.parentId
  token.dateCreated = event.block.timestamp
  
  // Transaction info - ESTO ES LO IMPORTANTE
  token.txHash = event.transaction.hash
  token.blockNumber = event.block.number
  token.blockTimestamp = event.block.timestamp
  
  // Obtener availableSupply del contrato (no está en el evento)
  let contract = SupplyChain.bind(event.address)
  let tokenView = contract.try_getTokenView(event.params.tokenId)
  
  if (!tokenView.reverted) {
    token.availableSupply = tokenView.value.value8
  } else {
    token.availableSupply = token.totalSupply
  }
  
  // Obtener inputs del token
  let inputs = contract.try_getTokenInputs(event.params.tokenId)
  if (!inputs.reverted) {
    for (let i = 0; i < inputs.value.length; i++) {
      let input = inputs.value[i]
      let tokenInputId = event.params.tokenId.toString() + "-" + input.tokenId.toString()
      let tokenInput = new TokenInput(tokenInputId)
      tokenInput.token = token.id
      tokenInput.inputTokenId = input.tokenId
      tokenInput.amount = input.amount
      tokenInput.save()
    }
  }
  
  // Intentar obtener info del usuario
  let userInfo = contract.try_getUserInfo(event.params.creator)
  if (!userInfo.reverted) {
    token.creatorRole = userInfo.value.role
    token.creatorCompany = userInfo.value.company
    
    // Crear o actualizar entidad User
    let user = User.load(event.params.creator.toHexString())
    if (user == null) {
      user = new User(event.params.creator.toHexString())
      user.address = event.params.creator
      user.tokensCreatedCount = BigInt.fromI32(0)
      user.transfersFromCount = BigInt.fromI32(0)
      user.transfersToCount = BigInt.fromI32(0)
    }
    user.role = userInfo.value.role
    user.company = userInfo.value.company
    user.contact = "" // contact field not in struct
    user.firstName = userInfo.value.firstName
    user.lastName = userInfo.value.lastName
    user.tokensCreatedCount = user.tokensCreatedCount.plus(BigInt.fromI32(1))
    user.save()
  }
  
  token.save()
}

export function handleTransferInitiated(event: TransferRequested): void {
  let transfer = new Transfer(event.params.transferId.toString())
  
  transfer.transferId = event.params.transferId
  transfer.from = event.params.from
  transfer.to = event.params.to
  transfer.tokenId = event.params.tokenId
  transfer.token = event.params.tokenId.toString()
  transfer.amount = event.params.amount
  transfer.dateCreated = event.block.timestamp
  transfer.status = 0 // Pending
  
  // Transaction info
  transfer.txHash = event.transaction.hash
  transfer.blockNumber = event.block.number
  transfer.blockTimestamp = event.block.timestamp
  
  transfer.save()
  
  // Update user counts
  let fromUser = User.load(event.params.from.toHexString())
  if (fromUser) {
    fromUser.transfersFromCount = fromUser.transfersFromCount.plus(BigInt.fromI32(1))
    fromUser.save()
  }
  
  let toUser = User.load(event.params.to.toHexString())
  if (toUser) {
    toUser.transfersToCount = toUser.transfersToCount.plus(BigInt.fromI32(1))
    toUser.save()
  }
}

export function handleTransferAccepted(event: TransferAccepted): void {
  let transfer = Transfer.load(event.params.transferId.toString())
  if (transfer) {
    transfer.status = 1 // Accepted
    transfer.save()
  }
}

export function handleTransferRejected(event: TransferRejected): void {
  let transfer = Transfer.load(event.params.transferId.toString())
  if (transfer) {
    transfer.status = 2 // Rejected
    transfer.save()
  }
}

export function handleTransferCancelled(event: TransferCancelled): void {
  let transfer = Transfer.load(event.params.transferId.toString())
  if (transfer) {
    transfer.status = 3 // Cancelled
    transfer.save()
  }
}

export function handleUserRegistered(event: UserRoleRequested): void {
  let user = new User(event.params.user.toHexString())
  user.address = event.params.user
  user.role = event.params.role
  user.company = ""
  user.contact = ""
  user.firstName = ""
  user.lastName = ""
  user.tokensCreatedCount = BigInt.fromI32(0)
  user.transfersFromCount = BigInt.fromI32(0)
  user.transfersToCount = BigInt.fromI32(0)
  
  // Intentar obtener detalles completos
  let contract = SupplyChain.bind(event.address)
  let userInfo = contract.try_getUserInfo(event.params.user)
  if (!userInfo.reverted) {
    user.company = userInfo.value.company
    user.contact = "" // contact field not in struct
    user.firstName = userInfo.value.firstName
    user.lastName = userInfo.value.lastName
  }
  
  user.save()
}
