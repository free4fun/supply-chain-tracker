import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  TokenCreated,
  TransferInitiated,
  TransferAccepted,
  TransferRejected,
  TransferCancelled,
  UserRegistered,
  SupplyChain
} from "../generated/SupplyChain/SupplyChain"
import { Token, Transfer, User, TokenInput } from "../generated/schema"

export function handleTokenCreated(event: TokenCreated): void {
  let token = new Token(event.params.tokenId.toString())
  
  token.tokenId = event.params.tokenId
  token.creator = event.params.creator
  token.dateCreated = event.params.timestamp
  
  // Transaction info - ESTO ES LO IMPORTANTE
  token.txHash = event.transaction.hash
  token.blockNumber = event.block.number
  token.blockTimestamp = event.block.timestamp
  
  // Obtener detalles del token del contrato
  let contract = SupplyChain.bind(event.address)
  let tokenView = contract.try_getTokenView(event.params.tokenId)
  
  if (!tokenView.reverted) {
    token.name = tokenView.value.value2
    token.description = tokenView.value.value3
    token.totalSupply = tokenView.value.value4
    token.features = tokenView.value.value5
    token.parentId = tokenView.value.value6
    token.availableSupply = tokenView.value.value8
  } else {
    token.name = ""
    token.description = ""
    token.totalSupply = BigInt.fromI32(0)
    token.features = ""
    token.parentId = BigInt.fromI32(0)
    token.availableSupply = BigInt.fromI32(0)
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
    token.creatorRole = userInfo.value.value2
    token.creatorCompany = userInfo.value.value5
    
    // Crear o actualizar entidad User
    let user = User.load(event.params.creator.toHexString())
    if (user == null) {
      user = new User(event.params.creator.toHexString())
      user.address = event.params.creator
    }
    user.role = userInfo.value.value2
    user.company = userInfo.value.value5
    user.contact = userInfo.value.value4
    user.firstName = userInfo.value.value6
    user.lastName = userInfo.value.value7
    user.save()
  }
  
  token.save()
}

export function handleTransferInitiated(event: TransferInitiated): void {
  let transfer = new Transfer(event.params.transferId.toString())
  
  transfer.transferId = event.params.transferId
  transfer.from = event.params.from
  transfer.to = event.params.to
  transfer.tokenId = event.params.tokenId
  transfer.token = event.params.tokenId.toString()
  transfer.amount = event.params.amount
  transfer.dateCreated = event.params.timestamp
  transfer.status = 0 // Pending
  
  // Transaction info
  transfer.txHash = event.transaction.hash
  transfer.blockNumber = event.block.number
  transfer.blockTimestamp = event.block.timestamp
  
  transfer.save()
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

export function handleUserRegistered(event: UserRegistered): void {
  let user = new User(event.params.user.toHexString())
  user.address = event.params.user
  user.role = event.params.role
  user.company = ""
  user.contact = ""
  user.firstName = ""
  user.lastName = ""
  
  // Intentar obtener detalles completos
  let contract = SupplyChain.bind(event.address)
  let userInfo = contract.try_getUserInfo(event.params.user)
  if (!userInfo.reverted) {
    user.company = userInfo.value.value5
    user.contact = userInfo.value.value4
    user.firstName = userInfo.value.value6
    user.lastName = userInfo.value.value7
  }
  
  user.save()
}
