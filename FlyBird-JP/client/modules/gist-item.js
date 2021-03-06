import MyDialog from '/modules/my-dialog.js'

let imageObserver
if ('IntersectionObserver' in window) {
    imageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting && 'url' in entry.target.dataset && entry.target.dataset.url.length > 0) {
                entry.target.src = entry.target.dataset.url
                delete entry.target.dataset.url
                imageObserver.unobserve(entry.target)
            }
        })
    })
}

export default {
    props: ['src', 'id', 'min', 'me'],
    watch: {
        'id': function (newVal, oldVal) {
            this.reset()
            this.print()
        },
        'src': function (newVal, oldVal) {
            this.reset()
            this.print()
        }
    },
    template: `<div class='gist-item' v-bind:class='{"min":min != null}'>
                    <div class='root' v-if='gist != null && log.length == 0'>
                        <a v-bind:href='gist.owner.html_url' class='icon'>
                            <img v-bind:data-url='gist.owner.avatar_url' v-if='lazyLoad' />
                            <img v-bind:src='gist.owner.avatar_url' v-if='!lazyLoad' />
                        </a>
                        <div v-bind:class='{"secret":!gist.public}'>
                            <a v-bind:href='gist.owner.html_url' class='name'>{{ gist.owner.login }}</a> / <a v-bind:href='gist.html_url' class='files'>{{ Object.keys(gist.files).join(', ') }}</a>
                        </div>
                        <span class='date'>{{ gist.created_at | dateFormat }}</span>
                        <span class='desc'>{{ gist.description || "No description." }}</span>
                        <span class='comments'>コメント：<a v-bind:href='gist.html_url + "#comments"'>{{ gist.comments }}件</a></span>
                        <div v-if='min == null && token != null' class='buttons'>
                            <button class='star' v-bind:class='{"starred":starred}' v-on:click='star()'>Star</button>
                            <button v-if='editable && !confirmFlag' class='delete' v-on:click='confirm()'>削除</button>
                            <button v-if='editable && confirmFlag' class='delete confirm' v-on:click='del()'>よろしいですか？</button>
                            <button v-if='!editable && !forked' class='forks' v-on:click='fork()'>Fork : {{ gist.forks.length }}</button>
                            <button v-if='!editable && forked' class='forks'>しばらくお待ちください...</button>
                        </div>
                    </div>
                    <div class='message center' v-if='log.length > 0'>{{ log }}</div>
                    <my-dialog ref='dialog'></my-dialog>
                </div>`,
    components: {
        'my-dialog': MyDialog
    },
    data: function () {
        return {
            'gist': null,
            'lazyLoad': false,
            'editable': false,
            'starred': false,
            'forked': false,
            'confirmFlag': false,
            'log': ''
        }
    },
    created: function () {
        this.lazyLoad = imageObserver != null
        this.isAuth = this.token != null

        this.print()
    },
    methods: {
        print: function () {
            this.getGist()
                .then(this.setGist)
                .then(() => {
                    if (this.min == null && this.token != null) {
                        this.isStarred().then((bool) => {
                            this.starred = bool
                        })
                    }
                })
                .catch((err) => {
                    this.log = err.toString()
                    this.$refs.dialog.alert('エラーが発生しました。', err.toString())
                })
        },
        getGist: async function () {
            if (this.src != null || this.id != null) {
                const url = this.src || `https://api.github.com/gists/${this.id}`
                const headers = new Headers()
                if (!url.startsWith('blob') && this.token != null) {
                    headers.append('Authorization', ` token ${this.token}`)
                }
                const response = await fetch(url, {
                    'headers': headers
                })
                if (response.ok) {
                    if (this.src != null && this.src.startsWith('blob')) URL.revokeObjectURL(this.src)
                    return await response.json()
                }
                else throw new Error(`${response.status} ${response.statusText}`)
            }
            else throw new Error('属性が不正です。')
        },
        setGist: function (json) {
            this.gist = json
            this.editable = this.gist.owner.login == this.me
            if (this.lazyLoad) {
                this.$nextTick().then(() => {
                    imageObserver.observe(this.$el.getElementsByTagName('img')[0])
                })
            }
        },
        isStarred: async function () {
            const response = await fetch(`https://api.github.com/gists/${this.gist.id}/star`, {
                'headers': new Headers({ 'Authorization': ` token ${localStorage.getItem('accessToken')}` })
            })
            switch (response.status) {
                case 204:
                    return true
                case 404:
                    return false
                default:
                    throw new Error(`${response.status} ${response.statusText}`)
            }
        },
        star: function () {
            let method
            if (this.starred) {
                method = 'DELETE'
            }
            else {
                method = 'PUT'
            }
            fetch(`https://api.github.com/gists/${this.gist.id}/star`, {
                'method': method,
                'headers': new Headers({ 'Authorization': ` token ${localStorage.getItem('accessToken')}` })
            })
                .then((response) => {
                    if (response.status == 204) this.starred = !this.starred
                    else throw new Error(`${response.status} ${response.statusText}`)
                }).catch((err) => {
                    this.$refs.dialog.alert('エラーが発生しました。', err.toString())
                })
        },
        fork: function () {
            this.forked = true
            fetch(`https://api.github.com/gists/${this.gist.id}/forks`, {
                'method': 'POST',
                'headers': new Headers({ 'Authorization': ` token ${localStorage.getItem('accessToken')}` })
            })
                .then((response) => {
                    if (response.status == 201) return response.json()
                    else throw new Error(`${response.status} ${response.statusText}`)
                })
                .then((json) => {
                    this.$router.push(`/gists/${json.id}`)
                })
                .catch((err) => {
                    this.$refs.dialog.alert('エラーが発生しました。', err.toString())
                })
        },
        del: function () {
            fetch(`https://api.github.com/gists/${this.gist.id}`, {
                'method': 'DELETE',
                'headers': new Headers({ 'Authorization': ` token ${localStorage.getItem('accessToken')}` })
            })
                .then((response) => {
                    if (response.status == 204) {
                        this.$refs.dialog.alert('削除しました。', 'トップページへ戻ります。', () => {
                            this.$router.push('/')
                        })
                    }
                    else throw new Error(`${response.status} ${response.statusText}`)
                })
                .catch((err) => {
                    this.$refs.dialog.alert('エラーが発生しました。', err.toString())
                })
        },
        confirm: function () {
            this.confirmFlag = true
            setTimeout(() => {
                this.confirmFlag = false
            }, 1000 * 5)
        },
        reset: function () {
            this.gist = null
            this.editable = this.starred = this.forked = false
            this.log = ''
        }
    }
}