import { SimpleTile, TileViewConstructor } from "@thirdroom/hydrogen-view-sdk";

import { TextMessageView } from "./TextMessageView";
import { AnnouncementView } from "./AnnouncementView";
import { WorldChatGap } from "./WorldChatGap";
import { ChatDate } from "./ChatDate";

export function viewClassForTile(vm: SimpleTile): TileViewConstructor<any> {
  switch (vm.shape) {
    case "gap":
      return WorldChatGap;
    case "announcement":
      return AnnouncementView;
    case "message":
    case "message-status":
      return TextMessageView;
    case "date-header":
      return ChatDate;
    default:
      throw new Error(
        `Tiles of shape "${vm.shape}" are not supported, check the tileClassForEntry function in the view model`
      );
  }
}
