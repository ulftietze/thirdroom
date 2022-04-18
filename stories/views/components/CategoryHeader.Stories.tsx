import { CategoryHeader } from "../../../src/ui/views/components/category/CategoryHeader";
import { IconButton } from "../../../src/ui/atoms/button/IconButton";
import StarIC from "../../../res/ic/star.svg";
import AddIC from "../../../res/ic/add.svg";
import MoreHorizontalIC from "../../../res/ic/more-horizontal.svg";

export function CategoryHeaderStories() {
  return (
    <div style={{ backgroundColor: "white", maxWidth: "380px" }}>
      <CategoryHeader iconSrc={StarIC} title="Favorite Worlds" />

      <CategoryHeader
        title="All Messages"
        options={
          <>
            <IconButton size="sm" label="Options" iconSrc={MoreHorizontalIC} onClick={(a) => alert("clicked")} />
            <IconButton size="sm" label="Notifications" iconSrc={AddIC} onClick={(a) => alert("clicked")} />
          </>
        }
      />

      <CategoryHeader
        iconSrc={StarIC}
        title="Favorite Rooms"
        onClick={() => alert("hello")}
        options={
          <>
            <IconButton size="sm" label="Options" iconSrc={MoreHorizontalIC} onClick={(a) => alert("clicked")} />
            <IconButton size="sm" label="Notifications" iconSrc={AddIC} onClick={(a) => alert("clicked")} />
          </>
        }
      />
    </div>
  );
}
