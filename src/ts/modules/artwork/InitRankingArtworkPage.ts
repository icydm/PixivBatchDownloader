// 初始化排行榜页面
import { InitPageBase } from '../InitPageBase'
import { Colors } from '../Colors'
import { API } from '../API'
import { lang } from '../Lang'
import { DOM } from '../DOM'
import { options } from '../Options'
import { form } from '../Settings'
import { RankingOption } from '../CrawlArgument'
import { RankingData } from '../CrawlResult'
import { FilterOption } from '../Filter.d'
import { filter } from '../Filter'
import { store } from '../Store'
import { log } from '../Log'

class InitRankingArtworkPage extends InitPageBase {
  constructor() {
    super()
    this.init()
  }

  protected appendCenterBtns() {
    DOM.addBtn('crawlBtns', Colors.blue, lang.transl('_抓取本排行榜作品'), [
      ['title', lang.transl('_抓取本排行榜作品Title')],
    ]).addEventListener('click', () => {
      form.debut.value = '0'
      this.readyCrawl()
    })

    // 判断当前页面是否有“首次登场”标记
    let debutModes = ['daily', 'daily_r18', 'rookie', '']
    let mode = API.getURLSearchField(location.href, 'mode')

    if (debutModes.includes(mode)) {
      DOM.addBtn('crawlBtns', Colors.blue, lang.transl('_抓取首次登场的作品'), [
        ['title', lang.transl('_抓取首次登场的作品Title')],
      ]).addEventListener('click', () => {
        form.debut.value = '1'
        console.log(form.debut.value)
        this.readyCrawl()
      })
    }
  }

  protected setFormOption() {
    // 设置“个数/页数”选项
    this.maxCount = 500

    options.setWantPage({
      text: lang.transl('_个数'),
      tip: lang.transl('_想要获取多少个作品'),
      rangTip: `1 - ${this.maxCount}`,
      value: this.maxCount.toString(),
    })
  }

  private pageCount: number = 10 // 排行榜的页数

  private resetOption(): RankingOption {
    return { mode: 'daily', p: 1, worksType: '', date: '' }
  }

  private option: RankingOption = this.resetOption()

  private setPartNum() {
    // 设置页数。排行榜页面一页有50张作品，当页面到达底部时会加载下一页
    if (location.pathname.includes('r18g')) {
      // r18g 只有1个榜单，固定1页
      this.pageCount = 1
    } else if (location.pathname.includes('_r18')) {
      // r18 模式，这里的6是最大值，有的排行榜并没有6页
      this.pageCount = 6
    } else {
      // 普通模式，这里的10也是最大值。如果实际没有10页，则在检测到404页面的时候停止抓取下一页
      this.pageCount = 10
    }
  }

  protected getWantPage() {
    this.listPageFinished = 0
    // 检查下载页数的设置
    this.crawlNumber = this.checkWantPageInput(
      lang.transl('_下载排行榜前x个作品'),
      lang.transl('_向下获取所有作品')
    )
    // 如果设置的作品个数是 -1，则设置为下载所有作品
    if (this.crawlNumber === -1) {
      this.crawlNumber = 500
    }
  }

  protected nextStep() {
    // 设置 option 信息
    // mode 一定要有值，其他选项不需要
    this.option = this.resetOption()
    this.option.mode = API.getURLSearchField(location.href, 'mode') || 'daily'
    this.option.worksType = API.getURLSearchField(location.href, 'content')
    this.option.date = API.getURLSearchField(location.href, 'date')

    this.startpageNo = 1

    this.setPartNum()
    this.getIdList()
  }

  protected async getIdList() {
    this.option.p = this.startpageNo + this.listPageFinished

    // 发起请求，获取作品列表
    let data: RankingData
    try {
      data = await API.getRankingData(this.option)
    } catch (error) {
      if (error.status === 404) {
        // 如果发生了404错误，则中断抓取，直接下载已有部分。因为可能确实没有下一部分了
        console.log('404错误，直接下载已有部分')
        this.getIdListFinished()
      }

      return
    }

    this.listPageFinished++

    const contents = data.contents // 取出作品信息列表
    for (const data of contents) {
      // 检查是否已经抓取到了指定数量的作品
      if (data.rank > this.crawlNumber) {
        return this.getIdListFinished()
      }

      // 目前，数据里并没有包含收藏数量，所以在这里没办法检查收藏数量要求
      const filterOpt: FilterOption = {
        id: data.illust_id,
        illustType: parseInt(data.illust_type) as any,
        tags: data.tags,
        pageCount: parseInt(data.illust_page_count),
        bookmarkData: data.is_bookmarked,
        width: data.width,
        height: data.height,
        yes_rank: data.yes_rank,
      }

      if (await filter.check(filterOpt)) {
        store.setRankList(data.illust_id.toString(), data.rank.toString())

        store.idList.push({
          type: API.getWorkType(data.illust_type),
          id: data.illust_id.toString(),
        })
      }
    }

    log.log(
      lang.transl('_排行榜进度', this.listPageFinished.toString()),
      1,
      false
    )

    // 抓取完毕
    if (this.listPageFinished === this.pageCount) {
      this.getIdListFinished()
    } else {
      // 继续抓取
      this.getIdList()
    }
  }

  protected resetGetIdListStatus() {
    this.listPageFinished = 0
  }
}
export { InitRankingArtworkPage }
