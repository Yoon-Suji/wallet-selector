import React, { useEffect, useState } from "react";
import styles from "./Modal.styles";
import { getState, updateState, State } from "../state/State";
import ILedgerWallet from "../interfaces/ILedgerWallet";
import { Options } from "../core/NearWalletSelector";
import IWallet from "../interfaces/IWallet";

declare global {
  // tslint:disable-next-line
  interface Window {
    updateWalletSelector: (state: State) => void;
  }
}

interface ModalProps {
  options: Options;
  wallets: Array<IWallet>;
  signIn: (walletId: string) => Promise<void>;
}

const Modal: React.FC<ModalProps> = ({ options, wallets, signIn }) => {
  const [ledgerDerivationPath] = useState("44'/397'/0'/0'/0'");
  const [ledgerCustomDerivationPath, setLedgerCustomDerivationPath] =
    useState("44'/397'/0'/0'/0'");
  const [ledgerWalletError, setLedgerWalletError] = useState("");
  const [useCustomDerivationPath, setUseCustomDerivationPath] = useState(false);
  const [walletInfoVisible, setWalletInfoVisible] = useState(false);
  const [accountId, setAccountId] = useState("");
  const defaultDescription = "Please select a wallet to connect to this dApp:";
  const [state, setState] = useState(getState());

  useEffect(() => {
    window.updateWalletSelector = (nextState) => {
      setState(nextState);
    };
  }, []);

  function onCloseModalHandler() {
    updateState((prevState) => ({
      ...prevState,
      showModal: false,
    }));
    setUseCustomDerivationPath(false);
    setLedgerCustomDerivationPath("44'/397'/0'/0'/0'");
    setLedgerWalletError("");
    setWalletInfoVisible(false);
  }

  function handleCloseModal(event: any) {
    event.preventDefault();
    if (event.target === event.currentTarget) onCloseModalHandler();
  }

  function getThemeClass(theme: string | null) {
    let themeClass = "";
    switch (theme) {
      case "dark":
        themeClass = "Modal-dark-theme";
        break;
      case "light":
        themeClass = "Modal-light-theme";
        break;
      default:
        themeClass = "";
        break;
    }
    return themeClass;
  }

  function onUseCustomPathHandler() {
    setUseCustomDerivationPath(true);
  }

  function onUseDefaultDerivationPathHandler() {
    setUseCustomDerivationPath(false);
    setLedgerWalletError("");
  }

  function onCustomDerivationPathChangeHandler(event: any) {
    setLedgerCustomDerivationPath(event.target.value);
  }

  function onAccountIdChangeHandler(event: any) {
    setAccountId(event.target.value);
  }

  return (
    <div style={{ display: state.showModal ? "block" : "none" }}>
      <style>{styles}</style>
      <div
        className={`Modal ${getThemeClass(options.theme)}`}
        onClick={handleCloseModal}
      >
        <div className="Modal-content">
          <div
            style={{ display: state.showWalletOptions ? "block" : "none" }}
            className="Modal-body Modal-select-wallet-option"
          >
            <p>{options.walletSelectorUI.description || defaultDescription}</p>
            <ul className="Modal-option-list">
              {wallets
                .filter((wallet) => wallet.getShowWallet())
                .map((wallet) => {
                  const { id, name, description, iconUrl } = wallet.getInfo();
                  const selected = state.signedInWalletId === id;

                  return (
                    <li
                      key={id}
                      id={id}
                      className={selected ? "selected-wallet" : ""}
                      onClick={() => {
                        signIn(id).catch((err) => {
                          console.log(`Failed to select ${name}`);
                          console.error(err);
                        });
                      }}
                    >
                      <div title={description}>
                        <img src={iconUrl} alt={name} />
                        <div>
                          <span>{name}</span>
                        </div>
                        {selected && (
                          <div className="selected-wallet-text">
                            <span>selected</span>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
          <div
            style={{
              display: state.showLedgerDerivationPath ? "block" : "none",
            }}
            className="Modal-body Modal-choose-ledger-derivation-path"
          >
            <p>
              Make sure your Ledger is plugged in, then select an account id and
              derivation path to connect your accounts:
            </p>
            <div className="derivation-paths-list">
              <div className="account-id">
                <input
                  type="text"
                  onChange={onAccountIdChangeHandler}
                  placeholder="Account Id"
                />
              </div>
              <button
                className={
                  !useCustomDerivationPath ? "path-option-highlighted" : ""
                }
                onClick={onUseDefaultDerivationPathHandler}
              >
                NEAR - 44'/397'/0'/0'/0'
              </button>
              {!useCustomDerivationPath && (
                <button
                  className={
                    useCustomDerivationPath ? "path-option-highlighted" : ""
                  }
                  onClick={onUseCustomPathHandler}
                >
                  Custom Path
                </button>
              )}
              {useCustomDerivationPath && (
                <input
                  autoFocus
                  className={ledgerWalletError ? "input-error" : ""}
                  type="text"
                  placeholder="custom derivation path"
                  value={ledgerCustomDerivationPath}
                  onChange={onCustomDerivationPathChangeHandler}
                />
              )}
              {ledgerWalletError && (
                <p className="error">{ledgerWalletError}</p>
              )}
            </div>
            <div className="derivation-paths--actions">
              <button className="left-button" onClick={onCloseModalHandler}>
                Dismiss
              </button>
              <button
                className="right-button"
                onClick={() => {
                  const derivationPath = useCustomDerivationPath
                    ? ledgerCustomDerivationPath
                    : ledgerDerivationPath;

                  const wallet = wallets.find((x) => {
                    const { id } = x.getInfo();

                    return id === state.signedInWalletId;
                  }) as ILedgerWallet;

                  wallet.setDerivationPath(derivationPath);
                  wallet.setAccountId(accountId);

                  wallet.signIn().catch((err) => {
                    setLedgerWalletError(`Error: ${err.message}`);
                  });
                }}
              >
                Connect
              </button>
            </div>
          </div>
          <div
            style={{
              display: state.showSenderWalletNotInstalled ? "block" : "none",
            }}
            className="Modal-body Modal-wallet-not-installed"
          >
            <div className="icon-display">
              <img src="https://senderwallet.io/logo.png" alt="Sender Wallet" />
              <p>SenderWallet</p>
            </div>
            <p>
              You'll need to install SenderWallet to continue. After installing
              <span
                className="refresh-link"
                onClick={() => {
                  window.location.reload();
                }}
              >
                &nbsp;refresh the page.
              </span>
            </p>
            <div className="action-buttons">
              <button
                className="left-button"
                onClick={() => {
                  updateState((prevState) => ({
                    ...prevState,
                    showWalletOptions: true,
                    showSenderWalletNotInstalled: false,
                  }));
                }}
              >
                Back
              </button>
              <button
                className="right-button"
                onClick={() => {
                  window.open(
                    "https://chrome.google.com/webstore/detail/sender-wallet/epapihdplajcdnnkdeiahlgigofloibg",
                    "_blank"
                  );
                }}
              >
                Open SenderWallet
              </button>
            </div>
          </div>
          <div
            style={{ display: state.showSwitchNetwork ? "block" : "none" }}
            className="Modal-body Modal-switch-network-message"
          >
            <div className="header">
              <h2>You Must Change Networks</h2>
            </div>
            <div className="content">
              <p>
                We've detected that you need to change your wallet's network to
                <strong>{` ${options.networkId}`}</strong> for this dApp.
              </p>
              <p>
                Some wallets may not support changing networks. If you can not
                change networks you may consider switching to another wallet.
              </p>
            </div>
            <div className="actions">
              <button className="left-button" onClick={onCloseModalHandler}>
                Dismiss
              </button>
              <button
                className="right-button"
                onClick={() => {
                  updateState((prevState) => ({
                    ...prevState,
                    showWalletOptions: true,
                    showSwitchNetwork: false,
                  }));
                }}
              >
                Switch Wallet
              </button>
            </div>
          </div>
          {options.walletSelectorUI.explanation && (
            <div className="info">
              <span
                onClick={() => {
                  setWalletInfoVisible(!walletInfoVisible);
                }}
              >
                What is a Wallet?
              </span>
              <div
                className={`info-description ${
                  walletInfoVisible ? "show" : "hide"
                }-explanation`}
              >
                <p>{options.walletSelectorUI.explanation}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;
