import { useState, FormEvent, useCallback, ChangeEvent } from "react";

import { Header } from "../../../atoms/header/Header";
import { HeaderTitle } from "../../../atoms/header/HeaderTitle";
import { Input } from "../../../atoms/input/Input";
import { Label } from "../../../atoms/text/Label";
import { SettingTile } from "../../components/setting-tile/SettingTile";
import { IconButton } from "../../../atoms/button/IconButton";
import { Button } from "../../../atoms/button/Button";
import { Text } from "../../../atoms/text/Text";
import { Dots } from "../../../atoms/loading/Dots";
import { Icon } from "../../../atoms/icon/Icon";
import { useHydrogen } from "../../../hooks/useHydrogen";
import CrossIC from "../../../../../res/ic/cross.svg";
import InfoIC from "../../../../../res/ic/info.svg";
import { Tooltip } from "../../../atoms/tooltip/Tooltip";
import { useDebounce } from "../../../hooks/useDebounce";
import { useSearchProfile } from "../../../hooks/useSearchProfile";
import { ProfileSuggestion } from "./ProfileSuggestion";

interface InviteDialogProps {
  roomId: string;
  requestClose: () => void;
}

export function InviteDialog({ roomId, requestClose }: InviteDialogProps) {
  const { session } = useHydrogen(true);

  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string>();

  const { loading, value: searchResult, setSearchTerm } = useSearchProfile(session);

  const inviteUser = async (userId: string) => {
    if (inviting) return;
    setError(undefined);
    setInviting(true);
    if (userId.match(/^@\S+:\S+$/) === null) {
      setError(`User id "${userId}" is invalid. Failed to invite.`);
      setInviting(false);
      return;
    }
    try {
      await session.hsApi.invite(roomId, userId).response();
      requestClose();
    } catch (err) {
      setError(`Failed to invite "${userId}".`);
    }
    setInviting(false);
  };

  const handleSubmit = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();

    const value = evt.currentTarget.input.value as string;
    inviteUser(value.trim());
  };

  const handleInputChange = useDebounce(
    useCallback(
      (evt: ChangeEvent<HTMLInputElement>) => {
        setError(undefined);
        setSearchTerm(evt.target.value);
      },
      [setSearchTerm]
    ),
    { wait: 400 }
  );

  return (
    <div className="flex flex-column">
      <Header
        className="shrink-0"
        left={<HeaderTitle size="lg">Invite</HeaderTitle>}
        right={<IconButton iconSrc={CrossIC} onClick={requestClose} label="Close" />}
      />
      <form onSubmit={handleSubmit} className="grow flex flex-column gap-lg" style={{ padding: "var(--sp-md)" }}>
        <div className="flex flex-column gap-sm">
          <SettingTile
            label={
              <>
                <Label>User Id</Label>
                <Tooltip content="User id looks like @user:server.name" side="right">
                  <Icon src={InfoIC} color="surface-low" size="sm" />
                </Tooltip>
              </>
            }
          >
            <Input
              onChange={handleInputChange}
              name="input"
              maxLength={255}
              autoFocus
              placeholder="@user:server.name"
              required
            />
          </SettingTile>
          {!inviting && error && (
            <Text variant="b3" color="danger" weight="medium">
              {error}
            </Text>
          )}
          <ProfileSuggestion loading={loading} searchResult={searchResult} onSelect={inviteUser} />
        </div>
        <Button size="lg" type="submit">
          {inviting && <Dots color="on-primary" />}
          {inviting ? "Inviting" : "Invite"}
        </Button>
      </form>
    </div>
  );
}
