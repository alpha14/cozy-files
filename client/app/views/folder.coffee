BaseView = require '../lib/base_view'
FilesView = require './files'
BreadcrumbsView = require "./breadcrumbs"
UploadStatusView = require './upload_status'
Modal = require './modal'
ModalBulkMove = require './modal_bulk_move'
ModalShareView = null

File = require '../models/file'

###
Handles the display logic for a folder.
Main entry point of the interface: handles breadcrumb, buttons and files list
###
module.exports = class FolderView extends BaseView

    el: 'body'

    template: require './templates/folder'

    events: ->
        'click #button-new-folder'     : 'onNewFolderClicked'
        # 'click #button-upload-new-file': 'onUploadNewFileClicked'
        'click #new-folder-send'       : 'onAddFolder'
        'click #cancel-new-folder'     : 'onCancelFolder'
        'click #cancel-new-file'       : 'onCancelFile'
        'click #share-state'           : 'onShareClicked'
        'click #download-link'         : 'onDownloadAsZipClicked'
        'change #uploader': 'onFilesSelected'
        'change #folder-uploader': 'onDirectorySelected'

        'change #select-all': 'onSelectAllChanged'
        'change input.selector': 'onSelectChanged'

        'click #button-bulk-remove': 'bulkRemove'
        'click #button-bulk-move'  : 'bulkMove'

        'dragstart #files' : 'onDragStart'
        'dragenter #files' : 'onDragEnter'
        'dragover #files'  : 'onDragEnter'
        'dragleave #files' : 'onDragLeave'
        'drop #files'      : 'onDrop'

        'keyup input#search-box'       : 'onSearchKeyPress'

    initialize: (options) ->
        super options
        @baseCollection = options.baseCollection
        @uploadQueue = options.uploadQueue

        # not empty only if a search has started
        @query = options.query

        # prevent contacts loading in shared area
        unless app.isPublic
            ModalShareView ?= require "./modal_share"

        # refresh folder action buttons after bulk actions
        @listenTo @baseCollection, 'toggle-select', @toggleFolderActions
        @listenTo @baseCollection, 'remove', @toggleFolderActions

        return this

    destroy: ->
        # reset selection for each models
        @collection.forEach (element) -> element.isSelected = false

        # properly destroy subviews
        @breadcrumbsView.destroy()
        @breadcrumbsView = null
        @filesList.destroy()
        @filesList = null

        super()

    getRenderData: ->
        supportsDirectoryUpload: @testEnableDirectoryUpload()
        model: @model.toJSON()
        query: @query
        zipUrl: @model.getZipURL()

    afterRender: ->
        @uploadButton = @$ '#button-upload-new-file'

        # breadcrumb management
        @renderBreadcrumb()

        # files list management
        @renderFileList()

        # upload status management
        @renderUploadStatus()

        # We make a reload after the view is displayed to update
        # the client without degrading UX
        @refreshData()

    renderBreadcrumb: ->
        @$('#crumbs').empty()
        @breadcrumbsView = new BreadcrumbsView collection: @model.breadcrumb, model: @model
        @$("#crumbs").append @breadcrumbsView.render().$el

    renderFileList: ->

        @filesList = new FilesView
                model: @model
                collection: @collection
                uploadQueue: @uploadQueue
                isSearchMode: @model.get('type') is "search"

        @filesList.render()

    renderUploadStatus: ->
        @uploadStatus = new UploadStatusView
            collection: @uploadQueue

        @uploadStatus.render().$el.appendTo @$('#upload-status-container')

    spin: (state = 'small') -> @$("#loading-indicator").spin state

    # Refresh folder's content and manage spinner
    refreshData: ->
        @spin()
        @baseCollection.getFolderContent @model, => @spin false

    ###
        Button handlers
    ###

    onNewFolderClicked: ->

        if @newFolder
            # there is already a new folder
            @filesList.views[@newFolder.cid].$('.file-edit-name').focus()
        else
            @newFolder ?= new File
                name: ''
                type: 'folder'
                path: @model.getRepository()

            @baseCollection.add @newFolder
            view = @filesList.views[@newFolder.cid]
            view.onEditClicked()

            @newFolder.once 'sync destroy', =>
                @newFolder = null


    onShareClicked: -> new ModalShareView model: @model

    ###
        Drag and Drop and Upload
    ###
    onDragStart: (e) ->
        e.preventDefault()
        e.stopPropagation()

    onDragEnter: (e) ->
        e.preventDefault()
        e.stopPropagation()
        if not @isPublic or @canUpload
            @uploadButton.addClass 'btn-cozy-contrast'
            @$('#files-drop-zone').show()

    onDragLeave: (e) ->
        e.preventDefault()
        e.stopPropagation()
        if not @isPublic or @canUpload
            @uploadButton.removeClass 'btn-cozy-contrast'
            @$('#files-drop-zone').hide()

    onDrop: (e) ->
        e.preventDefault()
        e.stopPropagation()
        return false if @isPublic and not @canUpload
        @onFilesSelected e
        @uploadButton.removeClass 'btn-cozy-contrast'
        @$('#files-drop-zone').hide()

    onDirectorySelected: (e) ->
        input = @$ '#folder-uploader'
        files = input[0].files
        return unless files.length
        @uploadQueue.addFolderBlobs files, @model
        # reset the input
        input.replaceWith input.clone true

    onFilesSelected: (e) =>
        files = e.dataTransfer?.files or e.target.files
        return unless files.length
        @uploadQueue.addBlobs files, @model
        if e.target?
            target = $ e.target
            # reset the input
            target.replaceWith target.clone true

    ###
        Search
    ###
    onSearchKeyPress: (e) ->
        query = @$('input#search-box').val()

        if query isnt ''
            route = "#search/#{query}"
        else
            route = ''

        window.app.router.navigate route, true

    # Refreshes the view by changing the files list
    # we basically re-do @initialize but only render file list
    # to prevent the focus loss in the search field
    updateSearch: (model, collection) ->
        @stopListening @model
        @stopListening @collection
        @model = model
        @collection = collection

        $('#upload-buttons').hide()

        # the first time the view is displayed, it doesn't exist yet
        if @filesList?
            @filesList.destroy()
            # because destroying the view also removes the element
            @$('#loading-indicator').after $ '<div id="files"></div>'
        @renderBreadcrumb()
        @renderFileList()


    ###
        Select elements management
    ###
    onSelectAllChanged: (event) ->
        isChecked = $(event.target).is ':checked'
        @$('input.selector').prop 'checked', isChecked
        @collection.forEach (element) ->
            element.isSelected = isChecked
            element.trigger 'toggle-select'

        @$('tr.folder-row').toggleClass 'selected', isChecked

        @toggleFolderActions()

    onSelectChanged: -> @toggleFolderActions()

    # Gets the number of selected elements from DOM
    getSelectedElements: ->
        return @collection.filter (element) ->
            return element.isSelected? and element.isSelected

    # we don't show the same actions wether there are selected elements or not
    toggleFolderActions: ->
        selectedElements = @getSelectedElements()
        if selectedElements.length > 0
            @$('#share-state').hide()
            @$('#upload-btngroup').hide()
            @$('#button-new-folder').hide()
            @$('#bulk-actions-btngroup').addClass 'enabled'
        else
            @$('#share-state').show()
            @$('#upload-btngroup').show()
            @$('#button-new-folder').show()
            @$('#bulk-actions-btngroup').removeClass 'enabled'

        # we check the "select-all" checkbox if there are few elements selected
        @$('input#select-all').prop 'checked', selectedElements.length >= 3


    ###
        Bulk actions management
    ###
    bulkRemove: ->
        new Modal t("modal are you sure"), t("modal delete msg"), t("modal delete ok"), t("modal cancel"), (confirm) =>
            if confirm
                async.eachLimit @getSelectedElements(), 10, (element, cb) ->
                    element.destroy error: -> cb()
                , (err) ->
                    Modal.error t("modal delete error")

    bulkMove: ->
        new ModalBulkMove
            collection: @getSelectedElements()
            parentPath: @model.getRepository()

    ###
        Misc
    ###
    testEnableDirectoryUpload: ->
        input = $('<input type="file">')[0]
        supportsDirectoryUpload = input.directory? or
                                  input.mozdirectory? or
                                  input.webkitdirectory? or
                                  input.msdirectory?
        return supportsDirectoryUpload

    # We don't want the user to download the ZIP if the folder is empty
    onDownloadAsZipClicked: (event) ->
        if @collection.length is 0
            event.preventDefault()
            Modal.error t 'modal error zip empty folder'
