import { transactions as Transactions, utils } from "near-api-js";
import {
  WalletModuleFactory,
  InjectedWallet,
  WalletBehaviourFactory,
  Action,
  FinalExecutionOutcome,
} from "@near-wallet-selector/core";
import {
  SignAndSendTransactionParams,
  ViewAccessKeyParams,
  WelldoneWalletParams,
  WelldoneWalletState,
} from "./injected-welldone";
import icon from "./icon";
import { createAction } from "@near-wallet-selector/wallet-utils";

async function initWalletState(): Promise<WelldoneWalletState> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wallet = (window as any).dapp;

  if (wallet) {
    return {
      wallet,
    };
  }
  return {};
}

const WelldoneWallet: WalletBehaviourFactory<InjectedWallet> = async ({
  options,
  metadata,
  // store,
  provider,
  emitter,
  logger,
}) => {
  const _state = await initWalletState();

  const _getAccounts = async () => {
    if (_state.wallet) {
      const res = await _state.wallet.request("near", {
        method: "dapp:accounts",
      });
      return res["near"] ? [res["near"].address, res["near"].pubKey] : [];
    }
    return [];
  };

  const _validateAccessKey = ({
    accountId,
    publicKey,
  }: ViewAccessKeyParams) => {
    logger.log("validateAccessKey", { accountId, publicKey });

    return provider.viewAccessKey({ accountId, publicKey }).then(
      (accessKey) => {
        logger.log("validateAccessKey:accessKey", { accessKey });

        if (accessKey.permission !== "FullAccess") {
          throw new Error("Public key requires 'FullAccess' permission");
        }

        return accessKey;
      },
      (err) => {
        if (err.type === "AccessKeyDoesNotExist") {
          return null;
        }

        throw err;
      }
    );
  };

  const convertActions = (actions: Array<Action>) => {
    const tempActions: Array<Transactions.Action> = [];
    actions.forEach((action) => {
      tempActions.push(createAction(action));
    });
    return tempActions;
  };

  const convertTransaction = (
    publicKey: string,
    nonce: number,
    hash: string,
    { signerId, receiverId, actions }: SignAndSendTransactionParams
  ) => {
    if (!signerId) {
      throw new Error("SignerId error");
    }

    if (!receiverId) {
      throw new Error("ReceiverId error");
    }

    const recentBlockHash = utils.serialize.base_decode(hash);
    const transaction = Transactions.createTransaction(
      signerId,
      utils.PublicKey.fromString(publicKey),
      receiverId,
      nonce,
      convertActions(actions),
      recentBlockHash
    );
    const bytes = transaction.encode();
    return Buffer.from(bytes).toString("base64");
  };

  const cleanup = () => {
    if (_state.account) {
      delete _state.account;
    }
  };

  const getAccounts = async () => {
    return _state.account ? [{ accountId: _state.account.accountId }] : [];
  };

  const signOut = async () => {
    cleanup();
    emitter.emit("signedOut", null);
  };

  const setupEvents = () => {
    if (_state.wallet) {
      _state.wallet.on("dapp:accountsChanged", async (newAccountId) => {
        logger.log("onAccountChange", newAccountId);
        signOut();
      });

      _state.wallet.on("dapp:chainChanged", async (rpc) => {
        logger.log("onNetworkChange", rpc);

        if (options.network.networkId !== rpc.networkId) {
          signOut();

          emitter.emit("networkChanged", { networkId: rpc.networkId });
        }
      });
    }
  };

  return {
    async signIn() {
      const existingAccounts = await getAccounts();

      if (existingAccounts.length) {
        return existingAccounts;
      }

      if (_state.account) {
        await signOut();
      }

      const account = await _getAccounts();

      const accessKey = await _validateAccessKey({
        accountId: account[0],
        publicKey: account[1],
      });

      if (!accessKey) {
        signOut();
        throw new Error(
          `Public key (${account[1]}) is not registered with the account '${account[0]}'.`
        );
      }

      _state.account = {
        accountId: account[0],
        publicKey: account[1],
      };

      setupEvents();

      return getAccounts();
    },

    signOut,

    getAccounts,

    async verifyOwner({ message }) {
      logger.log("Welldone:verifyOwner", { message });

      throw new Error(`Method not supported by ${metadata.name}`);
    },

    async signAndSendTransaction({ signerId, receiverId, actions }) {
      logger.log("signAndSendTransaction", { signerId, receiverId, actions });

      if (!_state.wallet) {
        throw new Error("Wallet is not installed");
      }

      if (!_state.account) {
        throw new Error("Wallet not signed in");
      }

      const accessKey = await provider.viewAccessKey(_state.account);

      const nonce = accessKey.nonce + 1;

      const transaction = convertTransaction(
        _state.account.publicKey,
        nonce,
        accessKey.block_hash,
        {
          signerId,
          receiverId,
          actions,
        }
      );

      const [txHash] = await _state.wallet.request("near", {
        method: "dapp:sendTransaction",
        params: [transaction],
      });

      return _state.wallet.request("near", {
        method: "tx",
        params: [txHash, signerId],
      });
    },

    async signAndSendTransactions({ transactions }) {
      if (!_state.wallet) {
        throw new Error("Wallet is not installed");
      }

      if (!_state.account) {
        throw new Error("Wallet not signed in");
      }

      const accessKey = await provider.viewAccessKey(_state.account);
      const publicKey = _state.account.publicKey;

      let nonce = accessKey.nonce;

      const convertedTxs = transactions.map((tx) => {
        nonce++;
        return convertTransaction(publicKey, nonce, accessKey.block_hash, tx);
      });

      const txHashes = await _state.wallet.request("near", {
        method: "dapp:sendTransaction",
        params: [...convertedTxs],
      });

      const results: Array<FinalExecutionOutcome> = [];

      for (let i = 0; i < txHashes.length; i++) {
        results.push(
          await _state.wallet.request("near", {
            method: "tx",
            params: [txHashes[i], transactions[i].signerId],
          })
        );
      }

      return results;
    },
  };
};

export function setupWelldoneWallet({
  iconUrl = icon,
  deprecated = false,
}: WelldoneWalletParams = {}): WalletModuleFactory<InjectedWallet> {
  return async () => {
    return {
      id: "welldone-wallet",
      type: "injected",
      metadata: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        available: !!(window as any).dapp,
        name: "WELLDONE Wallet",
        description: "WELLDONE Wallet for Multichains",
        iconUrl,
        deprecated,
        downloadUrl:
          "https://chrome.google.com/webstore/detail/welldone-wallet/bmkakpenjmcpfhhjadflneinmhboecjf",
      },
      init: WelldoneWallet,
    };
  };
}