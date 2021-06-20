import { eachMonthOfInterval, eachWeekOfInterval, lastDayOfYear, set, setDate } from 'date-fns'

export namespace DateUtils {
  export const lastDayOfCurrentYear = (): Date => lastDayOfYear(new Date())

  export const getWeeklyInterval = (startDate: Date, endDate: Date): Date[] =>
    eachWeekOfInterval(
      { start: startDate, end: endDate },
      { weekStartsOn: startDate.getDay() as 1 | 2 | 3 | 4 | 5 | 6 },
    ).map((weekStart) =>
      set(weekStart, { hours: startDate.getHours(), minutes: startDate.getMinutes(), seconds: startDate.getSeconds() }),
    )

  export const getMonthlyInterval = (startDate: Date, endDate: Date): Date[] =>
    eachMonthOfInterval({ start: startDate, end: endDate })
      .map((monthStart) => {
        const correctDate = setDate(monthStart, startDate.getDate())
        return set(correctDate, {
          hours: startDate.getHours(),
          minutes: startDate.getMinutes(),
          seconds: startDate.getSeconds(),
        })
      })
      .filter((date) => date.getTime() <= endDate.getTime())

  export const removeTime = (date: Date): Date => new Date(date.toDateString())
}
