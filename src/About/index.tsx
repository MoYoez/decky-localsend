import { FC } from "react";
import { ButtonItem, PanelSectionRow, Navigation } from "@decky/ui";
import { FiGithub } from "react-icons/fi";
import { FaGithub } from "react-icons/fa";

export const About: FC = () => {
  return (
    <div style={{margin: "100px"}}>
      <h2
        style={{ fontWeight: "bold", fontSize: "1.5em", marginBottom: "0px" }}
      >
        Decky Localsend Plugin
      </h2>
      <span>
        A plugin for Decky Loader that brings LocalSend functionality to Steam Deck in gaming mode.
        <br />
      </span>
      <PanelSectionRow>
        <span>If you like this plugin, please consider giving it a star on GitHub!</span>
        <ButtonItem
          icon={<FiGithub style={{ display: "block" }} />}
          label="Decky Localsend Plugin"
          onClick={() => {
            Navigation.NavigateToExternalWeb(
              "https://github.com/MoYoez/Decky-Localsend"
            );
          }}
        >
          GitHub Repo
        </ButtonItem>
      </PanelSectionRow>
      <h2
        style={{ fontWeight: "bold", fontSize: "1.5em", marginBottom: "0px" }}
      >
        Developer
      </h2>
      <PanelSectionRow>
        <ButtonItem
          icon={<FaGithub style={{ display: "block" }} />}
          label="MoeMagicMango"
          onClick={() => {
            Navigation.NavigateToExternalWeb(
              "https://github.com/MoYoez"
            );
          }}
        >
          GitHub Profile
        </ButtonItem>
      </PanelSectionRow>
    </div>
  );
};