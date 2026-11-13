const format = new Intl.DateTimeFormat("default", { year: "numeric", month: "long" });

/** Month name with previous/next buttons. */
export const ControlBar = (props: { year: number; month: number; onDateChange: (date: Date) => void }) => {
  const add = (x: number) => new Date(props.year, props.month + x, 1);
  return (
    <div class="calendar-control-bar">
      <i onClick={() => props.onDateChange(add(-1))} class="material-icons bar-item icon-btn">
        arrow_back
      </i>
      <span class="bar-item month-name">{format.format(new Date(props.year, props.month, 1))}</span>
      <i onClick={() => props.onDateChange(add(1))} class="material-icons bar-item icon-btn">
        arrow_forward
      </i>
    </div>
  );
};
